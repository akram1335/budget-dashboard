---
description: Build, push, and deploy to Claw Cloud
---
// turbo-all

## Deploy to Production

1. Build the production Docker image:
```bash
docker build -f Dockerfile.deploy -t budget-dashboard:deploy .
```

2. Tag for Docker Hub:
```bash
docker tag budget-dashboard:deploy akrambens/budget-dashboard:latest
```

3. Push to Docker Hub:
```bash
docker push akrambens/budget-dashboard:latest
```

4. Push code to GitHub:
```bash
git add -A && git commit -m "update" && git push --force
```

5. **Manual step**: Go to [Claw Cloud console](https://console.claw.cloud/) → click **Restart** on the `sarf` app. It will pull the new image automatically.

## Notes
- Docker Hub image: `akrambens/budget-dashboard:latest`
- Claw Cloud app name: `sarf`
- Public URL: https://fiummywabgoc.eu-central-1.clawcloudrun.com
- GitHub repo: https://github.com/akram1335/budget-dashboard
