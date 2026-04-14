# Real AI Deployment Checklist

## Cross-Portal Navigation Rollout (Approved)

- [ ] Super Admin: replace hamburger/toggle sidebar with always-visible desktop icon rail + hover-expand labels
- [ ] School Admin: replace hamburger/toggle sidebar with always-visible desktop icon rail + hover-expand labels
- [ ] Teacher: replace hamburger/toggle sidebar with always-visible desktop icon rail + hover-expand labels
- [ ] Student: replace hamburger/toggle sidebar with always-visible desktop icon rail + hover-expand labels
- [ ] Parent: replace hamburger/toggle sidebar with always-visible desktop icon rail + hover-expand labels
- [ ] Ensure all desktop sidebars are scrollable when content exceeds viewport (`overflow-y-auto`)
- [ ] Ensure temporary mobile overflow menus auto-close after tab selection
- [ ] Add mobile bottom tabs (icons) for Super Admin with `More` overflow
- [ ] Add mobile bottom tabs (icons) for School Admin with `More` overflow
- [ ] Add mobile bottom tabs (icons) for Teacher with `More` overflow
- [ ] Add mobile bottom tabs (icons) for Student with `More` overflow
- [ ] Add mobile bottom tabs (icons) for Parent with `More` overflow and preserve `ward` query context
- [ ] Verify active-route highlighting parity across desktop rail and mobile tabs for all portals
- [ ] Validate content inset spacing: desktop rail offset + mobile bottom-tab safe area for all portal layouts

## Pre-Deployment (Developer Machine)

- [x] Install @anthropic-ai/sdk dependency
- [x] Create aiLLMService.ts with Claude integration
- [x] Update /api/ai/command to use LLM
- [x] Add ai_powered badge to UI
- [x] Build succeeds (22.7s, 0 errors)
- [ ] Test locally with ANTHROPIC_API_KEY

### Local Testing
```bash
# 1. Set API key
echo "ANTHROPIC_API_KEY=sk-ant-YOUR_KEY" >> .env.local

# 2. Start server
npm run dev

# 3. Test features
# - Go to http://localhost:3000/ai
# - Select "Generate Test Plan"
# - Look for "✨ AI-Powered" badge
# - Export as CSV/PDF
# - Create regression ticket
```

---

## Staging Deployment

### Prerequisites
- [ ] Staging Supabase instance connected
- [ ] All migrations applied (022, 023, 024)
- [ ] RLS policies verified

### Deployment Steps

1. **Set Environment Variables**
   ```bash
   # In staging environment
   ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
   ```

2. **Deploy Code**
   ```bash
   git push staging main
   # or
   vercel deploy --prod  # if using Vercel
   ```

3. **Verify Build**
   ```bash
   # Check build logs - should show:
   # ✓ Compiled successfully in 22.7s
   # ✓ Generating static pages (19/19)
   ```

4. **Test Features**
   - [ ] Navigate to `/ai`
   - [ ] Run test plan generation
   - [ ] Verify "✨ AI-Powered" badge
   - [ ] Export CSV/PDF
   - [ ] Create regression ticket
   - [ ] Check audit logs show `ai_powered: true`

5. **Monitor for 24 Hours**
   - [ ] Check error logs for LLM failures
   - [ ] Monitor Anthropic API dashboard
   - [ ] Verify fallback works if API goes down
   - [ ] Check token usage matches expectations

---

## Production Deployment

### Prerequisites
- [x] Code merged to main
- [x] All tests passing
- [x] Staging validation complete
- [ ] Production Anthropic API key obtained
- [ ] Rate limiting configured (if needed)
- [ ] Monitoring alerts set up

### Deployment

1. **Configure Production API Key**
   ```bash
   # Add to production environment variables
   ANTHROPIC_API_KEY=sk-ant-prod-xxxxxxxxxxxxx
   ```

2. **Deploy to Production**
   ```bash
   # Using Vercel
   vercel promote staging-url
   
   # Or Git-based
   git push production main
   ```

3. **Post-Deployment Validation**
   ```bash
   # Check deployment successful
   curl https://yourapp.com/api/ai/command -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"task":"test_plan","targetRole":"teacher"}'
   
   # Should show "ai_powered": true in response
   ```

4. **Gradual Rollout (Optional)**
   - Deploy to 10% of users first
   - Monitor error rates
   - Gradually increase to 100%
   - Watch Anthropic API usage

5. **Set Up Monitoring**
   ```sql
   -- Track AI command success rate
   SELECT 
     task_type,
     COUNT(*) as total,
     SUM(CASE WHEN action_payload->>'ai_powered' = 'true' THEN 1 ELSE 0 END) as ai_powered_count,
     ROUND(100 * SUM(CASE WHEN action_payload->>'ai_powered' = 'true' THEN 1 ELSE 0 END)::float / COUNT(*), 2) as success_rate
   FROM ai_actions
   WHERE action_name = 'ai_command_executed'
     AND created_at > NOW() - INTERVAL '24 hours'
   GROUP BY task_type;
   ```

---

## Environment Variables

### Required
```bash
# Anthropic API (required for AI features)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
```

### Optional (Best Practices)
```bash
# Custom timeout (ms)
ANTHROPIC_TIMEOUT=30000

# Custom model (alternatives)
# ANTHROPIC_MODEL=claude-3-opus-20250219  # Smarter but slower
# ANTHROPIC_MODEL=claude-3-haiku-20250307 # Faster but less capable

# Cost tracking (if implementing)
TRACK_LLM_COSTS=true
```

---

## Rollback Plan

If Claude API causes issues:

### Option 1: Disable LLM (Immediate)
```typescript
// In aiLLMService.ts, comment out or disable
// All calls will use rule-based fallback
```

### Option 2: Disable for Specific Task
```typescript
// In /api/ai/command/route.ts
if (parsed.task === 'test_plan' && process.env.DISABLE_AI_TEST_PLANS) {
  // Skip LLM enhancement, use rule-based
}
```

### Option 3: Full Rollback
```bash
git revert <commit-hash>
git push production main
```

---

## Monitoring & Alerts

### Key Metrics to Track

1. **LLM Success Rate**
   ```sql
   SELECT 
     ROUND(100 * COUNT(CASE WHEN ai_powered THEN 1 END)::float / COUNT(*), 2) as success_rate
   FROM ai_actions
   WHERE created_at > NOW() - INTERVAL '1 hour';
   ```

2. **API Response Time**
   - Target: <5 seconds per command
   - Alert if: >10 seconds

3. **Error Rate**
   - Track LLM failures
   - Alert if: >5% failure rate

4. **Token Usage**
   - Monitor daily tokens used
   - Compare to quota
   - Alert if: >80% of monthly quota

### Set Up Alerts

**Sentry/Error Tracking**:
```python
sentry.capture_exception(llm_error)  # Automatically tracked
```

**Email Alerts**:
```sql
-- Alert if Claude fails >10% of requests
SELECT COUNT(*) 
FROM ai_actions 
WHERE outcome = 'failure' 
  AND created_at > NOW() - INTERVAL '1 hour'
  AND COUNT(*) > (SELECT COUNT(*) * 0.1 FROM ai_actions)
```

**Anthropic Dashboard**:
- Check https://console.anthropic.com for:
  - API usage graphs
  - Error rates
  - Token burn rate
  - Cost tracking

---

## Performance Tuning

### If Commands Are Slow

1. **Check Claude Response Time**
   ```bash
   time curl -X POST https://api.anthropic.com/v1/messages \
     -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "anthropic-version: 2023-06-01" \
     -H "content-type: application/json" \
     -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":100,"messages":[{"role":"user","content":"test"}]}'
   ```

2. **Reduce Token Limit**
   ```typescript
   // In aiLLMService.ts, reduce max_tokens
   max_tokens: 1024  // was 2048
   ```

3. **Use Faster Model**
   ```typescript
   // Switch to Claude Haiku (10x cheaper, faster)
   model: 'claude-3-haiku-20250307'
   ```

4. **Implement Caching**
   ```typescript
   // Cache similar requests for 1 hour
   const cacheKey = `${role}-${task}-${focus}`
   const cached = await redis.get(cacheKey)
   if (cached) return cached
   ```

---

## Cost Optimization

### Estimate Monthly Cost
```
Requests per day:     10
Days per month:       20
Tokens per request:   3,000 input + 1,000 output
Monthly total:        600,000 input + 200,000 output tokens

Input cost:  600k / 1M * $3  = $1.80
Output cost: 200k / 1M * $15 = $3.00
Total:       ~$5/month
```

### Ways to Reduce Cost

1. **Use Haiku Model** (10x cheaper)
   ```typescript
   model: 'claude-3-haiku-20250307'  // $0.80/$4 per 1M tokens
   ```

2. **Reduce max_tokens**
   ```typescript
   max_tokens: 1024  // instead of 2048
   ```

3. **Cache Results**
   ```typescript
   const cached = await cache.get(cacheKey)
   if (cached && !force) return cached
   ```

4. **Batch Requests**
   ```typescript
   // Process multiple commands in one API call if possible
   ```

---

## Troubleshooting Production Issues

### Problem: "✨ AI-Powered" badge not showing

**Check 1: API Key**
```bash
echo $ANTHROPIC_API_KEY  # Should not be empty
```

**Check 2: Server Logs**
```bash
# Look for "Generating AI-powered..." or error messages
tail -f logs/app.log | grep -i "ai\|claude\|anthropic"
```

**Check 3: Claude API Status**
```bash
# Check if service is down
curl https://api.anthropic.com/v1/status
```

### Problem: Very Slow Response Times

**Check 1: Claude API Performance**
```bash
time curl -X POST https://api.anthropic.com/v1/messages ...
# If >5 seconds, Claude is slow
```

**Check 2: Network**
```bash
ping api.anthropic.com  # Check latency
```

**Check 3: Rate Limiting**
```bash
# Check Anthropic dashboard for rate limit errors
```

### Problem: Commands Failing Completely

**Check 1: API Key Validity**
```bash
curl -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"test"}]}'
```

**Check 2: Fallback Working**
- If LLM fails, should fall back to rule-based
- Results should still appear (without AI badge)

**Check 3: Error Logs**
```sql
SELECT * FROM audit_logs 
WHERE action_type LIKE '%ai%' 
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## Maintenance

### Weekly
- [ ] Check Anthropic dashboard for anomalies
- [ ] Monitor token usage trends
- [ ] Review error logs

### Monthly
- [ ] Analyze AI quality metrics
- [ ] Get user feedback on results
- [ ] Optimize prompts if needed
- [ ] Check for API updates

### Quarterly
- [ ] Review model alternatives (new versions)
- [ ] Analyze cost vs benefit
- [ ] Plan enhancements

---

## Security Checklist

- [x] API key never in code
- [x] API key in environment variables only
- [x] API key not in logs/errors
- [x] Input sanitization implemented
- [x] Response validation implemented
- [x] Error handling doesn't expose details
- [x] Rate limiting considered
- [x] Fallback to rule-based if LLM fails

---

## Success Criteria

✅ **Deployment is successful if**:
- Build completes with 0 errors
- `/ai` page loads and renders
- "✨ AI-Powered" badge shows on results
- Test plan generation takes <5 seconds
- Fallback works if Claude API is down
- Audit logs show `ai_powered: true`
- No security warnings in logs
- Anthropic API dashboard shows usage

---

## Rollout Timeline

### Day 1: Staging
- Deploy to staging environment
- Test all features for 24 hours
- Monitor error rates

### Day 2: Production (Partial)
- Deploy to production
- Monitor 10% of users for 24 hours
- Check API usage and errors

### Day 3: Production (Full)
- Roll out to 100% of users
- Continue monitoring
- Gather user feedback

### Week 1: Optimization
- Fine-tune prompts based on feedback
- Optimize performance if needed
- Document results

---

**Ready to deploy! Follow the checklist above.** 🚀
