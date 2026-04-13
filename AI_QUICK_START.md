# ✨ Real AI Integration - Quick Start

## What's New?

Your AI Governance Assistant now uses **Claude 3.5 Sonnet** from Anthropic to power intelligent analysis:

| Feature | Before | After |
|---------|--------|-------|
| Test Case Generation | Templated (same for all roles) | **AI-generated** (unique edge cases per role) |
| Security Findings | Hardcoded list (5 items) | **AI-analyzed** (role-specific vulnerabilities) |
| Next Steps | Generic recommendations | **AI-powered** (contextual & actionable) |
| Recommendations | None | **Added** (intelligent suggestions) |

---

## 1-Minute Setup

### Step 1: Get Claude API Key
1. Go to https://console.anthropic.com
2. Sign up or log in
3. Click "Create a new API key"
4. Copy the key (starts with `sk-ant-`)

### Step 2: Add to Environment
```bash
# Edit .env.local
echo "ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE" >> .env.local
```

### Step 3: Restart Server
```bash
npm run dev
```

### Step 4: Test It
1. Go to http://localhost:3000/ai
2. Select "Generate Test Plan"
3. Choose "Teacher" role
4. Look for **"✨ AI-Powered"** badge on results
5. Export as CSV/PDF

---

## What Happens Behind the Scenes

### When you run AI commands:

```
1. You send: "Generate test plan for teacher role"
   ↓
2. System extracts: teacher features, route, objectives
   ↓
3. Claude analyzes: edge cases, boundary conditions, validation
   ↓
4. Claude generates: sophisticated test cases
   ↓
5. You get: AI-powered results + "✨ AI-Powered" badge
```

### Example Results

**Old (Rule-based)**:
```
Test: Assessments - score entry
Steps:
- Open assessments
- Enter a score
- Save
Expected: Score is saved
```

**New (AI-powered)**:
```
Test: Assessments - score entry validation
Steps:
- Open assessments with no active session
- Attempt to enter negative score
- Verify field validation error appears
- Enter valid score (0-100)
- Verify calculation updates
- Refresh page and verify persisted
Expected: Scores validate correctly with proper error messages
Priority: High
Boundary: Tests negative scores, session absence, persistence
```

---

## Cost & Usage

**Very cheap** (~$0.01-0.02 per command):
- Claude 3.5 Sonnet: $3 per million input tokens
- Average command: 2,000 input + 1,000 output tokens
- Monthly estimate: 10 commands/day × 20 days = 200 commands × $0.02 = **$4/month**

**Free tier**: 5M tokens/month (Claude free tier) = ~250 commands free

---

## Troubleshooting

### No "✨ AI-Powered" badge showing?

**Check 1**: Is API key set?
```bash
echo $ANTHROPIC_API_KEY  # Should show your key, not empty
```

**Check 2**: Is Claude API responding?
```bash
curl -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
```

**Check 3**: Check server logs
```bash
# Look for "Generating AI-powered test cases..." or error messages
```

### Getting errors in console?

System **automatically falls back** to rule-based results on failure. You'll still get usable results; just without the "✨ AI-Powered" badge.

---

## Full Documentation

For complete setup and advanced options, see:
- 📄 [AI_REAL_SETUP.md](AI_REAL_SETUP.md) - Full setup guide
- 📄 [AI_GOVERNANCE_AUDIT.md](AI_GOVERNANCE_AUDIT.md) - Complete feature audit

---

## Ready?

```bash
# 1. Set API key in .env.local
echo "ANTHROPIC_API_KEY=sk-ant-YOUR_KEY" >> .env.local

# 2. Start dev server
npm run dev

# 3. Go to /ai and generate a test plan
# 4. Look for ✨ AI-Powered badge!
```

---

**That's it! You now have real AI powering your governance assistant.** 🚀
