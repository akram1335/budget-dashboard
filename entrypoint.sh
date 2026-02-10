#!/bin/bash
set -e

# Fix permissions for /data directory (mounted volume might be owned by root)
if [ -d "/data" ]; then
    echo "🔒 Fixing permissions for /data..."
    chown -R appuser:appgroup /data
fi

# Execute the command as appuser
# "$@" matches the CMD in Dockerfile (uvicorn main:app ...)
echo "🚀 Starting application as appuser..."
exec gosu appuser "$@"
