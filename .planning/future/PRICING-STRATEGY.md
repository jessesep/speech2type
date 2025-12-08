# ONE Pricing & Business Model Strategy

> From open-source tool to sustainable platform

## Vision Statement

Build a **sustainable, user-first business model** that:
- Keeps core functionality free forever
- Offers premium features for power users and teams
- Enables creator economy through marketplace
- Funds ongoing development and support
- Aligns incentives with user success (not data mining)

---

## Core Principles

### 1. Free Core, Premium Features

```
┌─────────────────────────────────────────────────────────────┐
│                    PRICING PHILOSOPHY                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  FREE FOREVER:                                               │
│  ✅ Voice command recognition (cloud STT)                    │
│  ✅ Basic intent resolution                                  │
│  ✅ Personal dictionary (unlimited commands)                 │
│  ✅ All core voice controls                                  │
│  ✅ Command import/export                                    │
│  ✅ Community packages (free ones)                           │
│                                                              │
│  ONE PRO ($9/month or $79/year):                             │
│  ⭐ Local STT (offline, faster, private)                     │
│  ⭐ Adaptive intelligence (personal AI model)                │
│  ⭐ Unlimited workflows                                      │
│  ⭐ Premium voice packs                                      │
│  ⭐ Advanced context awareness                               │
│  ⭐ Priority support                                         │
│                                                              │
│  ONE TEAMS ($19/user/month):                                 │
│  👥 Everything in Pro                                        │
│  👥 Shared command libraries                                │
│  👥 Team analytics                                           │
│  👥 Centralized management                                   │
│  👥 SSO integration                                          │
│  👥 Dedicated support                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. No Dark Patterns

**We will NEVER:**
- Sell user data
- Lock users into subscriptions (easy cancel anytime)
- Hide the cancel button
- Charge for features that should be free
- Use bait-and-switch pricing
- Show ads in the app

**We will ALWAYS:**
- Be transparent about what you pay for
- Offer annual discounts (save ~25%)
- Allow easy upgrades/downgrades
- Provide generous free tier
- Give students/educators discounts

### 3. Align with User Success

**Good for users = Good for business**

```
User succeeds with ONE
    ↓
User becomes more productive
    ↓
User tells colleagues
    ↓
Organic growth (word of mouth)
    ↓
More users, more revenue
    ↓
Better product, more features
    ↓
User succeeds more (loop)
```

---

## Detailed Pricing Tiers

### FREE (Individual)

**Target Audience:** Casual users, students, open source contributors

**What's Included:**
- Unlimited voice commands
- Cloud-based STT (Deepgram/Whisper API)
- AI intent resolution (Claude Haiku)
- Personal command dictionary
- Up to 5 custom workflows
- Basic addons from marketplace
- Community support (forums)

**Limitations:**
- Internet required
- ~300ms latency (cloud STT)
- No adaptive learning
- Limited workflow complexity

**Why It's Generous:**
We want ONE to be accessible to everyone. The free tier is fully functional for most users.

---

### PRO ($9/month or $79/year)

**Target Audience:** Power users, developers, freelancers

**Everything in FREE, plus:**

#### 1. Local Processing
- Offline STT (Whisper.cpp)
- <100ms latency
- Privacy-first (data never leaves device)
- Works without internet

#### 2. Adaptive Intelligence
- Personal AI model (learns your vocab)
- Predictive intent (<50ms)
- Behavioral pattern detection
- Proactive suggestions

#### 3. Unlimited Workflows
- No limit on workflow count or complexity
- Advanced workflow features:
  - Conditional logic (if/else)
  - Loops and iterations
  - Variables and context
  - Multi-step confirmations

#### 4. Premium Features
- Custom wake words ("Hey [YourName]")
- Voice biometrics (security)
- Premium TTS voices (ElevenLabs, etc.)
- Advanced context detection

#### 5. Priority Support
- Email support (24hr response time)
- Video tutorials (Pro-only)
- Feature requests (higher priority)

**Pricing Rationale:**
- $9/month = Netflix tier (fair for productivity tool)
- $79/year = 2 months free (incentivize annual)
- Revenue supports local STT costs (no per-use API charges)

---

### TEAMS ($19/user/month, min 3 users)

**Target Audience:** Startups, agencies, dev teams

**Everything in PRO, plus:**

#### 1. Team Collaboration
- Shared command library (team commands sync to all)
- Team workflows (onboarding, standup, deployments)
- Role-based access (admins can curate shared commands)

#### 2. Analytics & Insights
- Team usage dashboard
- Popular commands report
- Productivity metrics
- Voice command success rates

#### 3. Management Console
```
┌─────────────────────────────────────────────────────────────┐
│  Team Admin Console - Acme Inc (12 users)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  👥 Users                                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  alice@acme.com     Admin      Last active: 2 min ago  │ │
│  │  bob@acme.com       Member     Last active: 5 min ago  │ │
│  │  carol@acme.com     Member     Last active: 1 hr ago   │ │
│  │  [+ Invite User]                                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  📚 Shared Command Library (23 commands)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  "deploy staging" → Workflow (used 47 times)           │ │
│  │  "open jira" → app:open JIRA (used 124 times)          │ │
│  │  "morning standup" → Workflow (used 89 times)          │ │
│  │  [+ Add Shared Command]                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  📊 Team Analytics                                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Total commands this month: 3,241                      │ │
│  │  Most active user: alice@acme.com (892 commands)       │ │
│  │  Top command: "deploy staging" (47 uses)               │ │
│  │  [View Detailed Report]                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 4. Enterprise Features
- SSO integration (Google Workspace, Okta, Azure AD)
- Centralized billing
- Volume licensing
- Audit logs
- Dedicated account manager (25+ users)

**Pricing Rationale:**
- $19/user = Competitive with Slack, Notion, etc.
- 3-user minimum = Targets actual teams, not individuals
- Scales with team size (fair)

---

### ENTERPRISE (Custom Pricing)

**Target Audience:** Large companies (50+ users), Fortune 500

**Contact sales for:**
- Custom deployment (on-premise or private cloud)
- Advanced security (SOC 2, HIPAA compliance)
- Custom integrations (internal tools)
- SLA guarantees (99.9% uptime)
- Dedicated support engineer
- Training and onboarding
- Custom AI model training (company-specific vocabulary)

**Typical Deal:**
- 100-500 users: $15-$17/user/month (annual contract)
- 500+ users: $12-$15/user/month (annual contract)
- Minimum contract: $15,000/year

---

## Add-On Pricing

### Marketplace Packages

**Free Packages:**
- Community-contributed
- Open source
- No cost to install

**Paid Packages:**
- Creator sets price ($0.99 - $49.99)
- ONE takes 30% (App Store model)
- User owns forever (one-time purchase)

**Subscription Packages:**
- For packages with ongoing costs (API usage, etc.)
- Creator sets monthly price
- ONE takes 30%
- User can cancel anytime

### Premium Voice Packs

**Included in Pro:**
- 5 high-quality TTS voices

**Additional Voice Packs:**
- $4.99 per voice pack (one-time)
- Celebrity voice packs: $9.99-$19.99
- Custom voice cloning: $29.99 (clone your own voice for TTS)

---

## Student & Educator Discounts

### Student Plan (50% off Pro)
- $4.50/month or $39/year
- Verify with email (@.edu) or Student Beans
- Renewable annually while enrolled

### Educator Plan (Free Pro)
- Free ONE Pro for teachers and professors
- Verify with school email or ID
- Can distribute to students (class license)

### Non-Profit Discount (30% off)
- For registered 501(c)(3) organizations
- Teams plan at $13.30/user/month

---

## Freemium Conversion Strategy

### Goal: Convert 5% of free users to Pro

**Tactics:**

#### 1. Feature Gating (Gentle)
```
Free user creates 6th workflow:

┌─────────────────────────────────────────────────────────────┐
│  Workflow Limit Reached                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  You've reached the 5-workflow limit on the free plan.      │
│                                                              │
│  Upgrade to Pro for:                                         │
│  ✓ Unlimited workflows                                      │
│  ✓ Local processing (faster, offline)                       │
│  ✓ Adaptive AI (learns your style)                          │
│  ✓ Priority support                                         │
│                                                              │
│  [Upgrade to Pro - $9/mo] [View Pricing] [Cancel]           │
│                                                              │
│  Or delete an existing workflow to stay on free plan.       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Trial Experience
- First 2 weeks: All Pro features unlocked
- User experiences the upgrade benefits
- At day 12: "2 days left in trial. Enjoying Pro features?"

#### 3. Value Demonstrations
```
Show user their stats:

"This month, you used ONE 247 times, saving ~4 hours of manual work.

With Pro, you'd save even more:
- 2x faster (local STT)
- Learns your shortcuts
- Works offline

Try Pro free for 14 days"
```

#### 4. Targeted Offers
- Heavy users (100+ commands/month): Offer Pro trial
- Workflow creators: "Unlock unlimited workflows"
- Privacy-conscious: "Keep everything local with Pro"

---

## Revenue Projections

### Year 1 (v1.0 - v1.5)

```
Users:
  Free: 10,000
  Pro: 300 (3% conversion)
  Teams: 50 users across 5 teams (avg 10 users/team)

Revenue:
  Pro: 300 × $9 × 12 = $32,400/year
  Teams: 50 × $19 × 12 = $11,400/year
  Marketplace (ONE's 30%): ~$2,000/year
  Total: ~$45,800/year

Costs:
  Cloud STT (Deepgram): 10,000 users × 100 mins/mo × $0.0043/min = $51,600/year
  Claude API (Haiku): 10,000 × 50 calls/mo × $0.00005 = $3,000/year
  Servers/hosting: $5,000/year
  Total: ~$59,600/year

Net: -$13,800 (expected - early investment)
```

### Year 2 (v2.0 - v2.5)

```
Users:
  Free: 50,000
  Pro: 3,000 (6% conversion - better value prop with v2.0 features)
  Teams: 500 users across 30 teams

Revenue:
  Pro: 3,000 × $9 × 12 = $324,000/year
  Teams: 500 × $19 × 12 = $114,000/year
  Marketplace: ~$30,000/year
  Total: ~$468,000/year

Costs:
  Cloud STT: 50,000 × 80 mins/mo × $0.0043 = $206,400/year
    (note: lower usage per user as Pro users go local)
  Claude API: 50,000 × 40 calls/mo × $0.00005 = $12,000/year
  Servers: $15,000/year
  Staff (1 full-time): $120,000/year
  Total: ~$353,400/year

Net: +$114,600 (profitable!)
```

### Year 3 (v3.0)

```
Users:
  Free: 200,000
  Pro: 20,000 (10% conversion)
  Teams: 3,000 users

Revenue:
  Pro: 20,000 × $9 × 12 = $2,160,000/year
  Teams: 3,000 × $19 × 12 = $684,000/year
  Enterprise: 2 deals × $50,000 = $100,000/year
  Marketplace: ~$200,000/year
  Total: ~$3,144,000/year

Costs:
  Infrastructure: $500,000/year
  Team (5 people): $600,000/year
  Total: ~$1,100,000/year

Net: +$2,044,000 (strong profitability)
```

---

## Go-to-Market Strategy

### Phase 1: Developer Community (v1.0)

**Channels:**
- Product Hunt launch
- Hacker News post
- Reddit (r/programming, r/productivity)
- Dev Twitter/X
- Open source GitHub

**Pricing:**
- Free only (build user base)
- No premium yet

**Goal:**
- 1,000 users in first month
- Strong word-of-mouth

### Phase 2: Introduce Pro (v1.5)

**Timing:** 3-4 months after launch
**Reasoning:** Users have tried it, see value

**Announcement:**
```
"ONE Pro is here!

After 1,000+ users and amazing feedback, we're launching ONE Pro:

✓ Local STT (offline, faster, private)
✓ Unlimited workflows
✓ Priority support
✓ Just $9/month

The free tier stays forever - we're committed to keeping
core functionality free for everyone.

Try Pro free for 14 days: [link]"
```

**Channels:**
- Email to existing users
- Blog post
- Social media
- In-app announcement

### Phase 3: Teams & Enterprise (v2.0)

**Timing:** 6-9 months after Pro launch
**Reasoning:** Individual users love it, bring to their teams

**Channels:**
- Sales outreach to companies using ONE
- Case studies (early team adopters)
- LinkedIn ads (target CTOs, VPs of Eng)
- Conference sponsorships (dev conferences)

---

## Competitive Pricing Analysis

| Product | Price | Model | Notes |
|---------|-------|-------|-------|
| **ONE** | Free / $9/mo | Freemium + Premium | Our pricing |
| Talon Voice | $15/mo | Subscription | More expensive, accessibility focus |
| Dragon | $300 one-time | One-time purchase | Old tech, Windows-only |
| GitHub Copilot | $10/mo | Subscription | Similar price point |
| Cursor | $20/mo | Subscription | More expensive |
| Raycast Pro | $8/mo | Freemium + Premium | Similar model |

**Our Advantage:**
- Competitive pricing ($9 vs $15)
- Generous free tier (vs Talon's no free tier)
- Modern tech (vs Dragon)
- Developer-focused (vs general consumer tools)

---

## Alternative Revenue Streams

### 1. Marketplace Revenue (30% cut)

```
Year 2 projections:
  200 paid packages
  Average price: $4.99
  Average sales: 50/package
  Total GMV: 200 × $4.99 × 50 = $49,900
  ONE's cut (30%): ~$15,000

Year 3 projections:
  500 packages × $4.99 × 100 = $249,500 GMV
  ONE's cut: ~$75,000
```

### 2. Premium Voice Packs

```
Year 2:
  3,000 Pro users × 20% buy extra voice = 600 purchases
  $4.99 average = $2,994

Year 3:
  20,000 Pro users × 20% = 4,000 purchases
  $4.99 average = $19,960
```

### 3. API Access (Future)

```
Allow developers to build on ONE's voice API:

ONE API Pricing:
  Free: 1,000 commands/month
  Starter: $29/mo (10,000 commands)
  Pro: $99/mo (100,000 commands)
  Enterprise: Custom (millions of commands)

Potential by Year 3: $50,000-$100,000/year
```

### 4. Training & Consulting (Future)

```
Offer paid services:
  - Team workshops: $2,000/day
  - Custom integrations: $5,000-$20,000
  - Enterprise onboarding: $10,000+

Potential: $50,000-$200,000/year (Year 3)
```

---

## Pricing Psychology

### Anchoring

```
Show this order:

❌ Free       $0/mo
✅ Pro        $9/mo    ← Most popular
👥 Teams     $19/mo
🏢 Enterprise Custom

(vs)

✅ Free       $0/mo    ← Most popular
❌ Pro        $9/mo
👥 Teams     $19/mo
🏢 Enterprise Custom
```

First version anchors to Pro, making it seem reasonable.
Second version anchors to Free, making Pro seem expensive.

**Our choice:** Anchor to Pro (it's our target)

### Decoy Pricing

```
Pro Monthly: $9/mo   = $108/year
Pro Annual:  $79/year  (save $29 = 27%)

Result: Annual seems like a great deal
```

### Good-Better-Best

```
Free   → Good (basic functionality)
Pro    → Better (all features, target tier) ← Push here
Teams  → Best (collaboration)
```

Most users pick the middle option. Make Pro the middle.

---

## Churn Prevention

### Reasons Users Cancel

1. Not using it enough
2. Too expensive
3. Missing key feature
4. Switched to competitor
5. No longer relevant (changed job, etc.)

### Prevention Tactics

#### Before Cancellation
```
User clicks "Cancel subscription":

┌─────────────────────────────────────────────────────────────┐
│  Before you go...                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  We're sorry to see you go. Can you tell us why?            │
│                                                              │
│  ○ Not using it enough                                      │
│  ○ Too expensive                                            │
│  ○ Missing features I need                                  │
│  ○ Found a better alternative                               │
│  ○ Other: _____________                                     │
│                                                              │
│  Based on your answer, we might offer:                      │
│  • Discount (50% off for 3 months)                          │
│  • Pause subscription (keep settings, no charge)            │
│  • Feature request prioritization                           │
│                                                              │
│  [Cancel Anyway] [Tell Us More]                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Win-Back Campaign

```
30 days after cancellation:

Email:
  Subject: "We miss you! Here's 50% off to come back"

  Hey [Name],

  We noticed you canceled ONE Pro last month. We've been
  improving the product based on feedback from users like you:

  ✓ Faster voice recognition
  ✓ New workflow features
  ✓ Better AI predictions

  We'd love to have you back. Here's 50% off for 3 months:
  [Claim Offer]

  If there's anything we can improve, just reply to this email.

  - The ONE Team
```

---

## Long-Term Sustainability

### Open Core Model

```
Open Source (MIT License):
  - Voice recognition engine
  - Command processing
  - Basic workflow system
  - Core integrations

Proprietary (ONE Pro/Teams):
  - Local AI models (fine-tuned)
  - Adaptive intelligence
  - Team collaboration features
  - Enterprise SSO/security
```

**Benefits:**
- Community can contribute to core
- Transparent codebase builds trust
- Premium features fund development
- Sustainable long-term

---

## Open Questions

1. **Lifetime License?**
   - Should we offer lifetime Pro for $299?
   - Pros: Large upfront revenue, loyal customers
   - Cons: Lost recurring revenue, harder to sustain

2. **Usage-Based Pricing?**
   - Charge per command instead of flat fee?
   - Pros: Fair for light users
   - Cons: Unpredictable billing, harder to budget

3. **Team Tier Minimum?**
   - Keep 3-user minimum or allow 2-user teams?
   - More flexibility vs revenue optimization

4. **Regional Pricing?**
   - Lower prices in emerging markets?
   - Pros: More accessible globally
   - Cons: Complex to manage, potential abuse

5. **Free Trial Length?**
   - 7 days vs 14 days vs 30 days?
   - Longer = more conversions but delayed revenue

---

*Last updated: 2025-12-08 by dreamer*
