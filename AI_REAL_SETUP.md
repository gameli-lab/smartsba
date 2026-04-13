# AI Governance Assistant - Real AI Setup Guide

## Overview

The AI Governance Assistant now uses **Claude 3.5 Sonnet** (Anthropic API) to power:
- ✅ AI-generated test cases (smarter edge cases and coverage)
- ✅ AI-enhanced security findings (real vulnerability analysis)
- ✅ AI-powered next steps (contextual recommendations)
- ✅ Intelligent test refinement (improve existing test cases)

## Prerequisites

1. **Anthropic Account**: Get API access at https://console.anthropic.com
2. **API Key**: Generate an API key from your Anthropic dashboard
3. **Package Installation**: Dependencies are already added to `package.json`

## Setup Steps

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

This installs `@anthropic-ai/sdk@^0.24.0`

### 2. Configure Environment Variables

Add to `.env.local`:

```bash
# Claude API Configuration
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx
```

### 3. Verify Configuration

Test that Claude is accessible:

```bash
curl -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 10,
    "messages": [{"role": "user", "content": "ping"}]
  }'
```

### 4. Start Development Server

```bash
npm run dev
```

### 5. Test AI Features

Navigate to `/ai` and test:

1. **Test Plan Generation**:
   - Select `Generate Test Plan` task
   - Choose a role (e.g., Teacher)
   - Look for "✨ AI-Powered" badge on results
   - Test cases should include sophisticated edge cases

2. **Security Audit**:
   - Select `Security Assessment` task
   - Results will include AI-analyzed vulnerabilities
   - Focus filter shows contextual findings

3. **Export & Tickets**:
   - Export test plans as CSV/PDF
   - Create regression tickets per test case

## How Real AI is Being Used

### Test Plan Generation

**Input**: Role + Feature checklist  
**Claude does**:
1. Analyzes each feature
2. Generates 1-2 comprehensive test cases
3. Includes edge cases and validation scenarios
4. Prioritizes critical workflows as "high"

**Example Claude prompt**:
```
Generate test cases for "teacher" user in education platform.
Features: Assessments, Attendance, Class views
Return JSON with detailed steps and expected results.
```

### Security Findings

**Input**: Role + Optional focus keyword  
**Claude does**:
1. Analyzes role-specific security risks
2. Identifies authorization boundaries
3. Finds data exposure vectors
4. Suggests specific remediation

**Areas analyzed**:
- Authorization/privilege escalation
- Data isolation & leakage
- Input validation issues
- Session management risks
- API security concerns

### Next Steps Generation

**Input**: Task type + Role + Generated findings/tests  
**Claude does**:
1. Generates contextual action items
2. Prioritizes recommendations
3. Makes steps immediately actionable

## Cost Estimation

Claude 3.5 Sonnet pricing (as of April 2026):
- Input: ~$3 per million tokens
- Output: ~$15 per million tokens

**Per AI command estimate**:
- Test plan: ~2,000 input + 1,000 output tokens = ~$0.01
- Security audit: ~1,500 input + 800 output tokens = ~$0.008
- Next steps: ~500 input + 300 output tokens = ~$0.002

**Total per command: ~$0.02** (very cheap)

## Fallback Behavior

If Claude API fails:
- ✅ System falls back to rule-based results
- ✅ No test cases/findings are lost
- ✅ User sees deterministic results instead of AI-enhanced
- ✅ Error is logged; system continues normally

Example:
```typescript
try {
  const aiTestCases = await generateAITestCases(...)
} catch (llmError) {
  console.warn('LLM enhancement failed, using rule-based results')
  // Fallback to rule-based test cases
}
```

## Security Best Practices

### 1. API Key Protection

❌ **DON'T**:
```bash
ANTHROPIC_API_KEY=sk-ant-xxx # in git repo
ANTHROPIC_API_KEY=sk-ant-xxx # in logs
ANTHROPIC_API_KEY=sk-ant-xxx # in client code
```

✅ **DO**:
```bash
# Only in .env.local (not committed)
# Never access from client-side
# Rotate keys regularly
# Use read-only API keys if available
```

### 2. Input Sanitization

All user inputs are sanitized before sending to Claude:
```typescript
// Cleaned in aiGovernanceService.ts
const focus = input.focus?.trim().slice(0, 100)
```

### 3. Response Validation

All Claude responses are:
- Parsed as JSON
- Validated against schema
- Type-checked
- Filtered for safety

### 4. Rate Limiting

To avoid excessive API calls:
```typescript
// Each command makes 2-3 API calls max
// Add retry logic if needed:
const MAX_RETRIES = 2
```

## Monitoring & Logging

### View AI Command Logs

Check the database:
```sql
-- See all AI commands with AI-powered flag
SELECT id, task_type, actor_role, (
  SELECT COUNT(*) FROM ai_test_cases WHERE session_id = ai_sessions.id
) as test_count
FROM ai_sessions
ORDER BY created_at DESC
LIMIT 20;

-- Check action payloads
SELECT action_payload FROM ai_actions
WHERE action_name = 'ai_command_executed'
ORDER BY created_at DESC;
```

### Monitor API Usage

```bash
# Check Anthropic dashboard for:
# - API calls per day
# - Tokens used
# - Error rates
# - Cost tracking
```

## Troubleshooting

### "ANTHROPIC_API_KEY environment variable is not set"

**Solution**: Add key to `.env.local`
```bash
echo "ANTHROPIC_API_KEY=sk-ant-xxxx" >> .env.local
npm run dev
```

### "Failed to generate AI test cases from Claude response"

**Cause**: Claude response format changed  
**Solution**: Check Claude API docs, verify JSON structure

### "Claude API rate limit exceeded"

**Cause**: Too many requests  
**Solution**:
- Wait 60 seconds
- Implement exponential backoff
- Contact Anthropic for higher limits

### "Response type is not text"

**Cause**: Unexpected Claude response format  
**Solution**: Check Claude SDK version, verify model availability

## Advanced Configuration

### Use Different Claude Model

In `src/services/aiLLMService.ts`, change:
```typescript
model: 'claude-3-opus-20250219', // Use Opus (slower, more capable)
// or
model: 'claude-3-haiku-20250307', // Use Haiku (faster, cheaper)
```

### Adjust Token Limits

```typescript
const message = await client.messages.create({
  max_tokens: 4096, // Increase for more detailed responses
  model: 'claude-3-5-sonnet-20241022',
  ...
})
```

### Add Request Timeout

```typescript
const client = new Anthropic({
  apiKey,
  timeout: 30000, // 30 second timeout
})
```

### Implement Token Counting

```typescript
// Estimate cost before making request
function estimateCost(inputTokens: number, outputTokens: number) {
  const inputCost = (inputTokens / 1000000) * 3 // $3 per million
  const outputCost = (outputTokens / 1000000) * 15 // $15 per million
  return inputCost + outputCost
}
```

## API Reference

### generateAITestCases(role, features)

**Returns**: `Promise<LLMTestCase[]>`

Generates AI-enhanced test cases for a role.

```typescript
const testCases = await generateAITestCases('teacher', [
  { title: 'Assessments', route: '/teacher/assessments', check: '...' }
])
```

### generateAISecurityFindings(role, focus)

**Returns**: `Promise<LLMSecurityFinding[]>`

Generates security findings for a role.

```typescript
const findings = await generateAISecurityFindings('super_admin', 'auth')
```

### generateAINextSteps(task, role, targetRole, findings, testCases)

**Returns**: `Promise<string[]>`

Generates contextual next steps.

```typescript
const steps = await generateAINextSteps('test_plan', 'super_admin', 'teacher', 5, 12)
```

### refineTestCases(testCases, feedback)

**Returns**: `Promise<LLMTestCase[]>`

Improves existing test cases based on feedback.

```typescript
const improved = await refineTestCases(existingCases, 'add more edge cases')
```

### checkClaudeAvailability()

**Returns**: `Promise<boolean>`

Checks if Claude API is accessible.

```typescript
const available = await checkClaudeAvailability()
if (!available) console.warn('Claude API is unavailable')
```

## Performance Notes

- **First API call**: ~3-5 seconds
- **Cached results**: Instant (session history)
- **Fallback time**: <100ms (rule-based)
- **Network**: Requires internet connectivity

## Next Steps

1. ✅ Set `ANTHROPIC_API_KEY` in `.env.local`
2. ✅ Run `npm run dev`
3. ✅ Navigate to `/ai`
4. ✅ Generate a test plan → Look for "✨ AI-Powered" badge
5. ✅ Export as CSV/PDF
6. ✅ Create regression tickets
7. ✅ Monitor in Anthropic dashboard

---

**Support**: For issues, check Anthropic docs at https://docs.anthropic.com
