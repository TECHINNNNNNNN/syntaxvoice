import express from 'express'
import cors from 'cors'
import { experimental_transcribe as transcribe, generateText, streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import path from 'path'
import multer from 'multer'
import {PrismaClient} from './generated/prisma/index.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import Stripe from 'stripe'
import e from 'express'

const prisma = new PrismaClient()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '..', '.env') })

// Initialize Stripe AFTER envs are loaded; pin API version to match Stripe CLI
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-07-30.basil' })
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

const app = express()

const PORT = process.env.PORT || 1234
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
const ALLOWED_ORIGINS = CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
const TRANSCRIPTION_MODEL = process.env.TRANSCRIPTION_MODEL || 'whisper-1'
const CHAT_MODEL = process.env.CHAT_MODEL || 'gpt-4'
const FREE_MONTHLY_TRANSCRIPTIONS = Number(process.env.FREE_MONTHLY_TRANSCRIPTIONS) || 20

function isSubscriptionActive(status){
    return status === 'active'
}
function addOneMonthSameDayUTC(from = new Date()) {
    const y = from.getUTCFullYear()
    const m = from.getUTCMonth()
    const d = from.getUTCDate()
    const nextY = m === 11 ? y + 1 : y
    const nextM = (m + 1) % 12
    const lastDayNextM = new Date(Date.UTC(nextY, nextM + 1, 0)).getUTCDate()
    const day = Math.min(d, lastDayNextM)
    return new Date(Date.UTC(nextY, nextM, day, from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), 0))
}


const upload = multer({ storage: multer.memoryStorage() })

const corsOption = {
    origin: ALLOWED_ORIGINS.length <= 1 ? ALLOWED_ORIGINS[0] : ALLOWED_ORIGINS,
    optionsSuccessStatus: 200
}

// Stripe webhook must receive the RAW body. Register this route BEFORE express.json().
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature']
    let event
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } catch (error) {
        console.error('Webhook signature verification failed')
        return res.status(400).json({ error: 'Invalid signature' })
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object
                const customerId = session.customer
                if (typeof customerId === 'string') {
                    // Prefer mapping via customer metadata we set during checkout
                    const customer = await stripe.customers.retrieve(customerId)
                    const appUserIdMeta = typeof customer !== 'string' ? customer.metadata?.appUserId : undefined
                    const user = appUserIdMeta
                        ? await prisma.user.findUnique({ where: { id: Number(appUserIdMeta) } })
                        : await prisma.user.findUnique({ where: { email: session.customer_details?.email || '' } })
                    if (user && !user.stripeCustomerId) {
                        await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } })
                    }
                }
                break
            }
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const sub = event.data.object
                const customerId = sub.customer
                if (typeof customerId === 'string') {
                    const stripeStatus = sub.status
                    const isActive = (stripeStatus === 'active' || stripeStatus === 'trialing')
                    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null

                    const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } })
                    if (user) {
                        await prisma.user.update({
                            where: { id: user.id },
                            data: {
                                subscriptionStatus: isActive ? 'active' : null,
                                currentPeriodEnd: periodEnd
                            }
                        })
                    }
                }
                break
            }
            case 'customer.subscription.deleted': {
                const sub = event.data.object
                const customerId = sub.customer
                if (typeof customerId === 'string') {
                    const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } })
                    if (user) {
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { subscriptionStatus: null }
                        })
                    }
                }
                break
            }
            default: {
                console.log(`Unhandled event type ${event.type}`)
                break
            }
        }

        res.json({ received: true })
    } catch (error) {
        console.error('Webhook processing error:', error)
        res.status(500).json({ error: 'Failed to process webhook' })
    }
})

// Now it is safe to use JSON parsing for all other routes
app.use(express.json())
app.use(cors(corsOption))

app.get('/', (req, res) => {
    res.send('Hello World!')
})

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) return res.status(401).json({error: "No token provided"})

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded
        return next()
    } catch (error) {
        return res.status(401).json({error: 'Invalid token'})
    }
}

app.get('/me', authenticateToken, async (req,res) => {
    try {
        const userId = req.user.userId
        if (!userId) return res.status(400).json({error: "User ID not found"})
        const user = await prisma.user.findUnique({
            where: {id: Number(userId)},
            select: {id: true, email: true, name: true, subscriptionStatus: true, currentPeriodEnd: true, monthlyTranscriptions: true, stripeCustomerId: true}
         })

        console.log(`userId: ${userId}`)
        if (!user) return res.status(404).json({error: "User not found"})
        
        const freeLimit = Number.isFinite(FREE_MONTHLY_TRANSCRIPTIONS) ? FREE_MONTHLY_TRANSCRIPTIONS : 20
        const used = user.monthlyTranscriptions || 0
        const remaining = freeLimit - used

        console.log(`freeLimit: ${freeLimit}, used: ${used}, remaining: ${remaining}`)

        return res.status(200).json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                subscriptionStatus: user.subscriptionStatus,
                currentPeriodEnd: user.currentPeriodEnd,
            },
            usage: {
                monthlyTranscriptions: used,
                freeLimit: freeLimit,
                remaining: remaining
            }
        })
    } catch (error) {
        res.status(500).json({error: "Failed to fetch profile"})
    }
})

app.post('/register', async (req, res) => {
    try {
        const {email, password, name} = req.body
        if (!email || !password){
            return res.status(400).json({error: "Please fill in email and password"})
        }

        const existingUser = await prisma.user.findUnique({
            where: {email}
        })
        
        if (existingUser){
            return res.status(400).json({error: "User already exists"})
        }
        const hashedPassword = await bcrypt.hash(password, 10)
        const newUser = await prisma.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                name
            },
            select : {id: true, email:true, name:true}
        })

        const token = jwt.sign({userId: newUser.id, email: newUser.email}, process.env.JWT_SECRET, {expiresIn: '7d'})

        res.status(201).json({message: "User created successfully", token, user: newUser})

    } catch (error) {
        res.status(400).json({error: "Failed to register user"})
        
    }
})

app.post('/login', async (req, res) => {
    try {
        const {email, password} = req.body
        if (!email || !password){
            return res.status(400).json({error: "Please fill in email and password"})
        }

        const existingUser = await prisma.user.findUnique({
            where: {email}
        })

        if (!existingUser){
            return res.status(400).json({error: "User does not exist"})
        }

    const isPasswordValid = await bcrypt.compare(password, existingUser.passwordHash)

        if (!isPasswordValid){
            return res.status(400).json({error: "Invalid password"})
        }

        const token = jwt.sign({userId: existingUser.id, email: existingUser.email}, process.env.JWT_SECRET, {expiresIn: '7d'})

        res.status(200).json({message: "Login successful", token, user: {id: existingUser.id, email: existingUser.email, name: existingUser.name}})
    } catch (error) {
        res.status(400).json({error: "Failed to login user"})
    }
})


app.post('/project', authenticateToken, async (req, res) => {
    const {name, description} = req.body
    const userId = req.user?.userId
    if (!name || !userId){
        return res.status(400).json({error: "Please fill in project name and userId"})
    }
    try {
        const newProject = await prisma.project.create({
            data: {
                name,
                description,
                userId: req.user.userId
            }
        })

        res.status(201).json({message: "Project created successfully", project: newProject})
    } catch (error){
        res.status(400).json({error: "Failed to create project"})
    }
})

app.get('/project/:id', authenticateToken, async (req,res) => {
    console.log(typeof req.params.id)
    const projectId = Number(req.params.id)
    const userId = req.user.userId
    if (!projectId || !userId){
        return res.status(400).json({error: "Project ID or User ID not found"})
    }

    console.log('Fetching project:', projectId, 'for user:', userId)

    try {
        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                userId
            },
            include: { messages: true }
        })

        console.log('Fetched project:', project)

        if (!project){
            return res.status(404).json({error: "Project not found"})
        }

        res.status(200).json({project})
    } catch (error) {
        res.status(500).json({error: "Failed to fetch project"})
    }
})

app.get('/projects', authenticateToken, async (req, res) => {
    const userId = req.user?.userId
    if (!userId){
        return res.status(400).json({error: "User ID not found"})
    }

    try {
        const projects = await prisma.project.findMany({
            where: {userId},
            orderBy: { createdAt: 'desc' }
        })

        res.status(200).json({projects})
    } catch (error) {
        res.status(500).json({error: "Failed to fetch projects"})
    }
})

app.patch('/project/:id', authenticateToken, async (req, res) => {
    const {id} = req.params
    const {name, description, techStack} = req.body
    const userId = req.user?.userId

    if (!id || !userId) {
        return res.status(400).json({ error: "Project ID or User ID not found" })
    }

    try {
        const existingProject = await prisma.project.findFirst({
            where: { id: Number(id), userId }
        })
        if (!existingProject || existingProject.userId !== userId) {
            return res.status(404).json({ error: "Project not found or access denied" })
        }

        const updatatedProject = await prisma.project.update({
            where: { id: Number(id) },
            data: { name, description , techStack}
        })

        res.status(200).json({ message: "Project updated successfully", project: updatatedProject })
    } catch (error) {
        res.status(500).json({ error: "Failed to update project" })
    }
})

app.patch('/enhance-project-context', authenticateToken, async (req,res) => {
    const { projectId,name, description, techStack } = req.body
    console.log(`projectId: ${projectId}, description: ${description}, techStack: ${techStack}`)

    try {
        const updatedDetailsProject = await prisma.project.update({
            where: { id: Number(projectId) },
            data: {name, description, techStack  }
        })

        res.status(200).json({message: "Project context enhanced successfully", project: updatedDetailsProject})
    } catch (error) {
        res.status(500).json({error: "Failed to enhance project context"})
    }
})

app.post('/transcribe',authenticateToken, upload.single('audio'), async (req, res) => {
    const {projectId} = req.body
    const userId = req.user?.userId
    if (!userId){
        return res.status(400).json({error: "User ID not found"})
    }


    const user = await prisma.user.findUnique({
        where: {id: Number(userId)},
        select: {subscriptionStatus: true, currentPeriodEnd: true, monthlyTranscriptions: true}
    })

    if (!user){
        return res.status(404).json({error: "User not found, maybe you are not logged in"})
    }
    
    const active = isSubscriptionActive(user.subscriptionStatus) ?? null

    if (!active){
        const now = new Date()
        const periodEnd = user.currentPeriodEnd ? new Date(user.currentPeriodEnd) : null
        if (!periodEnd || now >= periodEnd){
            await prisma.user.update({
                where: {id: Number(userId)},
                data: {
                    monthlyTranscriptions: 0,
                    currentPeriodEnd: addOneMonthSameDayUTC(now)
                }
            })
            user.monthlyTranscriptions = 0
        }

        if ((user.monthlyTranscriptions ?? 0) >= FREE_MONTHLY_TRANSCRIPTIONS){
            return res.status(402).json({
                code: 'quota_exceeded',
                message: 'Free monthly limit reached',
                freeLimit: FREE_MONTHLY_TRANSCRIPTIONS
            })
        }
    }

    try {
        if (!req.file){
            return res.status(400).json({error: "No file uploaded"})
        }
        const audioBuffer = new Uint8Array(req.file.buffer)

        const transcript = await transcribe({
            model: openai.transcription(TRANSCRIPTION_MODEL),
            audio: audioBuffer,
        })

        const previousMessages = await prisma.message.findMany({
            where: {projectId: Number(projectId)},
            orderBy: { createdAt: 'asc' },
            select: { content: true , enhancedPrompt: true },
            take: 10
        })

        const project = await prisma.project.findUnique({
            where: {id: Number(projectId)}
        })

        if (!project){
            return res.status(404).json({error: "Project not found"})
        }

        const buildContextualSystemPromp = (project) => {
            return (
                `PROJECT CONTEXT:
                - Tech Stack: ${project.techStack || 'Not specified'}
                - Description: ${project.description || 'No description provided'}`
            )
        }



        const messages = [
            {
                role: 'system',
                content: `You are an expert AI prompt engineer specializing in voice-to-code workflows. You help developers by:
                ${buildContextualSystemPromp(project)}

                1. Converting casual speech into structured XML coding prompts
                2. Understanding the context of their ongoing project
                3. Building upon previous conversations and code discussions
                4. Tailoring responses specifically for their coding style and project needs

                Previous conversation context: This is an ongoing coding project. Reference past messages to provide contextual, relevant assistance.

                Always return responses in this XML format:
                <task>
                <context>Background about the current situation and how it relates to previous discussions</context>
                <action>Direct instruction using "you" language, building on previous context</action>  
                <requirements>Technical requirements considering the project's current state</requirements>
                <output_format>What should be returned as output</output_format>
                </task>`
            },
            ...previousMessages.flatMap(msg => [
                {role: 'user', content: msg.content},
                {role: 'assistant', content: msg.enhancedPrompt || ''}
            ]),
            { role: 'user', content: `Convert this casual speech into a structured coding prompt, considering our previous conversation: "${transcript.text}"` }
        ]


        const result = await streamText({
            model: openai(CHAT_MODEL),
            messages: messages,
            maxTokens: 1000,
        })

        res.setHeader('Content-Type','text/plain; charset=utf-8')
        res.setHeader('Transfer-Encoding', 'chunked')

        res.write(JSON.stringify({originalTranscript: transcript.text}) + '\n---\n')


        
        let enhancedPrompt = ''
        for await (const textPart of result.textStream) {
            res.write(textPart);
            enhancedPrompt += textPart
        }

        res.end()


        await prisma.message.create({
            data: {
                projectId: Number(projectId),
                content: transcript.text,
                enhancedPrompt: enhancedPrompt,
                type: 'audio',
            }
        })

        if(!active){
            if (user.monthlyTranscriptions == null){
                await prisma.user.update({
                    where: {id: Number(userId)},
                    data: {
                        monthlyTranscriptions: 0
                    }
                })
                user.monthlyTranscriptions = 0
            }
            await prisma.user.update({
                where: {id: Number(userId)},
                data: {
                    monthlyTranscriptions: {
                        increment: 1
                    }
                }
            })
        }

    } catch (error) {
        console.error('Transcription error:', error)
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to transcribe audio' });
        }
    }
})

app.post('/process', (req, res) => {
    const {text} = req.body
    console.log(text)
    res.status(200).json({message: 'Text received', text})
})


// ------------------------------------------------------------------------------------------------


app.post('/billing/checkout', authenticateToken, async (req,res) => {
    try {
        const userId = req.user?.userId
        if (!userId){
            return res.status(400).json({error: "User ID not found in billing checkout request"})
        }

        const user = await prisma.user.findUnique({
            where: {id: Number(userId)},
            select: {id: true,email: true,name: true,stripeCustomerId: true}
        })

        if (!user){
            return res.status(404).json({error: "User not found in billing checkout request"})
        }

        let customerId = user.stripeCustomerId
        if (!customerId){
            const customer = await stripe.customers.create({
                email: user.email || undefined,
                name: user.name || undefined,
                metadata: {appUserId: String(user.id)}
            })
            customerId = customer.id
            await prisma.user.update({
                where: {id: Number(userId)},
                data: {stripeCustomerId: customerId}
            })
        }

        const price = req.body?.priceId || process.env.STRIPE_PRICE_ID
        if (!price) {
            return res.status(400).json({error: "Price ID not provided in billing checkout request"})
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: customerId,
            line_items: [{price: price, quantity: 1}],
            allow_promotion_codes: true,
            success_url: `${FRONTEND_URL}/project/new?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${FRONTEND_URL}/project/new?checkout=cancelled`,
        })

        return res.status(200).json({url: session.url})
            
    } catch (error) {
        console.error('Billing checkout error:', error)
        return res.status(500).json({error: "Failed to create billing checkout session"})
    }
})

app.post('/billing/portal', authenticateToken, async (req,res) => {
    try {
        const userId = req.user?.userId
        if (!userId){
            return res.status(400).json({error: "User ID not found in billing portal request"})
        }
        const user = await prisma.user.findUnique({
            where: {id: Number(userId)},
            select: {id: true,stripeCustomerId: true}
        })

        if (!user) return res.status(404).json({error: "User not found in billing portal request"})
        if (!user.stripeCustomerId) return res.status(400).json({error: "User does not have a stripe customer id"})

        const portal = await stripe.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: `${FRONTEND_URL}/project/new`,
        })

        return res.status(200).json({url: portal.url})
    } catch (error) {
        console.error('Billing portal error:', error)
        return res.status(500).json({error: "Failed to create billing portal session"})
    }
})




app.listen(PORT, () => {
    console.log(`Server is running on PORT: ${PORT}`)
})


