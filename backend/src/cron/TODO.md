# Cron Job Centralization TODO

Completed:
- [x] Checkout feat/cron-job-centralization
- [x] 1. Create CronJobLog entity
- [x] 2. CronJobService.run() wrapper
- [x] 3. Registry + missed run processor
- [x] 4. Admin endpoints stub
- [x] 5. CronModule + integrate
- [x] 6. Tests (run/timeout/fail)

Remaining:
1. Update existing jobs to use CronJobService.run()
2. Full admin endpoints implementation
3. DB migration for CronJobLog
4. Schedule health check job
5. PR

**Next:** Update existing jobs (rates.processor.ts etc.).



