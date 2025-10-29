# 🎙️ SyntaxVoice

**Transform casual voice notes into production-ready AI prompts**

SyntaxVoice is a full-stack web application that converts developer voice recordings into structured, context-aware XML task documents. Built for developers who want to quickly capture ideas and get AI-ready prompts without manually formatting them.

[Live Demo](#) | [Video Walkthrough](#)

---

## 🎯 The Problem

As a developer working with AI coding assistants, I found myself constantly:
- Interrupting my flow to type out detailed prompts
- Spending time formatting context and requirements
- Losing the nuance of verbal explanations when translating to text
- Manually maintaining project context across multiple conversations

**The solution**: Speak naturally, get structured prompts instantly.

---

## ✨ Key Features

### 🎤 Smart Voice Recording
- Real-time audio visualization with 5-band equalizer
- Automatic duration limiting (2-minute default, configurable)
- Live countdown timer and audio feedback cues
- Optimized audio encoding (Opus @ 64kbps for minimal file size)

### 🤖 AI-Powered Enhancement
- **Whisper API** transcription for accurate speech-to-text
- **GPT-4** transformation of casual speech into structured XML tasks
- Context-aware prompts that remember your project details
- Real-time streaming of enhanced output

### 📂 Project Organization
- Multi-project workspace with persistent conversation history
- Project-specific context (tech stack, description)
- Automatic project naming from first voice note
- Message history preserved for context continuity

### 💳 Subscription System
- Freemium model: 20 free transcriptions/month
- Stripe checkout integration with webhook automation
- Automatic quota tracking and reset
- Billing portal for subscription management

### 🛡️ Security & Rate Limiting
- JWT-based authentication
- Rate-limited endpoints (login: 10/15min, transcribe: 6/5min)
- Protected routes on frontend
- File upload validation (MIME type, size, duration)

---

## 🏗️ Technical Architecture

### Backend Stack
```
Node.js + Express
├── Prisma ORM (PostgreSQL)
├── OpenAI SDK (Whisper + GPT-4)
├── Stripe API (subscriptions)
├── JWT (authentication)
├── Multer (file uploads)
└── express-rate-limit (protection)
```

### Frontend Stack
```
React + TypeScript + Vite
├── React Router (navigation)
├── React Hook Form + Zod (validation)
├── Tailwind CSS (styling)
├── Web Audio API (visualization)
└── Lucide React (icons)
```

### Database Schema
```prisma
User
├── Projects (1:many)
│   └── Messages (1:many)
├── Stripe integration
└── Quota tracking

Project
├── name, description, techStack
└── conversation history

Message
├── original transcript
├── enhanced prompt
└── timestamp
```

---

## 💡 Technical Highlights & Challenges Overcome

### 1. **Real-Time Streaming Response**
**Challenge**: Display AI-generated prompts as they're created, not after completion.

**Solution**: Implemented chunked transfer encoding on the backend and incremental DOM updates on the frontend. The response comes in two parts:
```javascript
// Backend streams: JSON header + separator + streamed XML
res.write(JSON.stringify({originalTranscript}) + '\n---\n')
for await (const textPart of result.textStream) {
    res.write(textPart)
}
```

Frontend parses the stream incrementally, showing the original transcript immediately and building the enhanced prompt in real-time.

### 2. **Intelligent Context Management**
**Challenge**: Make each prompt contextually aware of the project and previous conversations.

**Solution**: Built a dynamic prompt system that injects:
- Project metadata (tech stack, description)
- Last 10 messages for conversation continuity
- Custom XML schema with CDATA sections for code safety

```javascript
const messages = [
    { role: 'system', content: buildContextualSystemPrompt(project) },
    ...previousMessages.flatMap(msg => [
        { role: 'user', content: msg.content },
        { role: 'assistant', content: msg.enhancedPrompt }
    ]),
    { role: 'user', content: currentTranscript }
]
```

### 3. **Robust Stripe Integration**
**Challenge**: Handle the full subscription lifecycle with proper error handling.

**Solution**: 
- Webhook processing for `checkout.session.completed`, `subscription.created/updated/deleted`
- Customer ID mapping via metadata (`appUserId`)
- Auto-healing for TEST/LIVE mode switches
- Portal generation for subscription management

```javascript
// Auto-heal stale customers across Stripe modes
if (customerId) {
    try {
        await stripe.customers.retrieve(customerId)
    } catch {
        await prisma.user.update({ 
            where: { id: userId }, 
            data: { stripeCustomerId: null } 
        })
        customerId = null
    }
}
```

### 4. **Client-Side Audio Duration Tracking**
**Challenge**: Enforce server-side duration limits without processing entire file.

**Solution**: Extract duration from MediaRecorder blob metadata and send as form data:
```javascript
const maybeDuration = (audioBlob as unknown as { duration?: number }).duration
if (typeof maybeDuration === 'number' && Number.isFinite(maybeDuration)) {
    formData.append('durationMs', String(Math.round(maybeDuration * 1000)))
}
```

Server validates before transcription to fail fast and save API costs.

### 5. **Quota System with Auto-Reset**
**Challenge**: Track free-tier usage and reset monthly without cron jobs.

**Solution**: Just-in-time quota check on each transcription:
```javascript
const now = new Date()
const periodEnd = user.currentPeriodEnd ? new Date(user.currentPeriodEnd) : null
if (!periodEnd || now >= periodEnd) {
    await prisma.user.update({
        where: { id: userId },
        data: {
            monthlyTranscriptions: 0,
            currentPeriodEnd: addOneMonthSameDayUTC(now)
        }
    })
}
```

### 6. **Rate Limiting Strategy**
**Challenge**: Prevent abuse while maintaining good UX.

**Implementation**:
- Login: 10 attempts per 15 minutes (prevent brute force)
- Transcribe: 6 requests per 5 minutes (prevent API quota exhaustion)
- Standard headers enabled for client-side retry logic

### 7. **Advanced Audio Visualization**
**Challenge**: Create engaging real-time audio feedback during recording.

**Solution**: Web Audio API analyser with frequency domain processing:
```javascript
analyser.getByteTimeDomainData(dataArray)
// Split into 5 frequency bands
const slice = Math.floor(array.length / 5)
// Calculate peak amplitude per band
// Normalize and map to visual heights (3-27px)
```

Result: 5-bar equalizer that reacts to voice amplitude in real-time.

---

## 🚀 What I Learned

### Technical Growth
- **Streaming APIs**: First time implementing real-time text streaming with proper buffering
- **Web Audio**: Deep dive into MediaRecorder, AudioContext, and AnalyserNode
- **Stripe Webhooks**: Production-grade payment integration with lifecycle management
- **Prisma**: Advanced ORM patterns with custom client generation paths
- **Rate Limiting**: Practical implementation for production security

### Architecture Decisions
- **Freemium from Day 1**: Built billing logic upfront to avoid retrofit pain
- **Context Windows**: Limiting to last 10 messages balances context vs. API costs
- **XML over JSON**: Chose XML for prompt format because it handles nested code better with CDATA
- **Streaming over Polling**: Better UX and lower server load than waiting for full response

### Production Considerations
- **Error boundaries**: Graceful degradation when audio APIs aren't available
- **CORS handling**: Multi-origin support for staging/production environments
- **Logging middleware**: Request/response/duration tracking for debugging
- **File validation**: Triple-check (MIME, size, duration) before expensive API calls

---

## 📊 Performance Optimizations

1. **Audio Codec Selection**: Cascade through `opus → mp4` to minimize upload size (64kbps vs 128kbps)
2. **Database Queries**: Selected fields only (`select: { id, email, name }`) to reduce payload
3. **Token Limits**: Capped GPT-4 response to 1000 tokens for cost control
4. **Memory Storage**: Used Multer memory storage (vs disk) for faster processing
5. **Client-Side Validation**: Zod schemas catch errors before network round-trip

---

## 🎨 Design Philosophy

**Glassomorphic UI**: Created a cohesive design system with:
- Glass effects using `backdrop-filter: blur()`
- Subtle gradients and transparency layers
- Custom font system (display vs. body)
- Amber accent color for call-to-action elements

**Microinteractions**:
- Ripple effect on mic button press
- Smooth auto-scroll to latest message
- Toast notifications for clipboard copy
- Audio cues (beep) for record start/stop

**Accessibility**:
- Proper ARIA labels on buttons
- Keyboard navigation support
- Disabled states clearly indicated
- Loading states for all async operations

---

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database
- OpenAI API key
- Stripe account (test mode works)

### Backend Setup
```bash
cd backend
npm install

# Environment variables (.env)
DATABASE_URL="postgresql://user:password@localhost:5432/syntaxvoice"
JWT_SECRET="your-secret-key"
OPENAI_API_KEY="sk-..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ID="price_..."
CORS_ORIGIN="http://localhost:5173"

# Run migrations
npx prisma migrate dev

# Start server
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install

# Environment variables (.env)
VITE_BASE_URL="http://localhost:1234"
VITE_MAX_UPLOAD_DURATION_MS="120000"

# Start dev server
npm run dev
```

### Stripe Webhook Testing
```bash
stripe listen --forward-to localhost:1234/webhooks/stripe
```

---

## 🔐 Environment Variables Reference

### Backend
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `1234` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | Token signing key | Required |
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `STRIPE_SECRET_KEY` | Stripe secret key | Required |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | Required |
| `STRIPE_PRICE_ID` | Subscription price ID | Required |
| `TRANSCRIPTION_MODEL` | Whisper model | `whisper-1` |
| `CHAT_MODEL` | Chat model | `gpt-4` |
| `FREE_MONTHLY_TRANSCRIPTIONS` | Free tier limit | `20` |
| `MAX_AUDIO_DURATION_MS` | Max recording length | `120000` |
| `MAX_UPLOAD_BYTES` | Max file size | `10485760` |
| `RATE_LOGIN` | Login attempts | `10` |
| `RATE_LOGIN_WINDOW_MS` | Login window | `900000` |
| `RATE_TRANSCRIBE` | Transcription requests | `6` |
| `RATE_TRANSCRIBE_WINDOW_MS` | Transcription window | `300000` |

### Frontend
| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_BASE_URL` | Backend API URL | `http://localhost:1234` |
| `VITE_MAX_UPLOAD_DURATION_MS` | Max recording time | `120000` |

---

## 🚢 Deployment

### Backend (Fly.io)
```bash
cd backend
fly deploy
```

### Frontend (Vercel)
```bash
cd frontend
vercel --prod
```

**Post-deployment**:
1. Update Stripe webhook URL to production domain
2. Set production environment variables
3. Update CORS_ORIGIN to include production frontend
4. Test full checkout flow in Stripe test mode

---

## 🔮 Future Enhancements

- [ ] **Team Collaboration**: Shared projects with permission levels
- [ ] **Export Formats**: PDF, Markdown, plain text export
- [ ] **Voice Commands**: "Delete last message", "Start new project"
- [ ] **Custom Prompts**: User-defined XML schemas
- [ ] **Analytics Dashboard**: Usage trends, most active projects
- [ ] **Mobile App**: React Native version for iOS/Android
- [ ] **Multi-language**: Support for non-English voice notes
- [ ] **Cloud Storage**: S3 integration for audio archive

---

## 🤝 Contributing

This is a personal portfolio project, but I'm open to suggestions and feedback! Feel free to:
- Open an issue for bugs or feature requests
- Submit a PR for typo fixes or documentation improvements
- Reach out with questions about implementation details

---

## 📄 License

MIT License - feel free to use this code for learning purposes.

---

## 🙏 Acknowledgments

- **OpenAI** for Whisper and GPT-4 APIs
- **Stripe** for seamless payment infrastructure
- **Prisma** for excellent developer experience
- **Vercel & Fly.io** for hassle-free deployment

---

## 📬 Contact

Built with ❤️ by Techin Chompooborisuth

- Portfolio: [techinboom.com](https://techinboom.com)
- LinkedIn: [linkedin.com/in/techin-chompooborisuth](https://www.linkedin.com/in/techin-chompooborisuth-396b19268)
- GitHub: [github.com/TECHINNNNNNNN](https://github.com/TECHINNNNNNNN)
- Email: [chompooborisuthtechin@gmail.com](mailto:chompooborisuthtechin@gmail.com)

---

## 💭 Reflections

**Why I Built This**:  
As someone who uses AI coding assistants daily, I noticed a gap between how I *think* about tasks (casual, verbal) and how I need to *communicate* them to AI (structured, precise). This project bridges that gap while teaching me production-grade full-stack development.

**What Makes Me Proud**:
1. **Real-time streaming** - The instant feedback loop feels magical
2. **Context awareness** - Prompts get better as projects grow
3. **Production-ready billing** - Not just a prototype, it's monetizable
4. **Polish** - Microinteractions and animations matter

**What I'd Do Differently**:
- Add comprehensive test coverage (Jest + Playwright)
- Implement Redis for session management at scale
- Use WebSockets for true bidirectional real-time updates
- Add database query performance monitoring

This project represents my growth from tutorial-follower to architect—making real architectural decisions, handling edge cases, and shipping production-quality code.

---

**⭐ If this project helps you, consider giving it a star!**

