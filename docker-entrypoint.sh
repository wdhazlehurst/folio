#!/bin/bash
set -e

if [ -z $"NEXTAUTH_SECRET" ]; then
    echo "NEXTAUTH_SECRET is not set!"
    exit 1
fi

npx prisma migrate deploy

exec "$@"