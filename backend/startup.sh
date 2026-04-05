#!/bin/bash
cd /home/site/wwwroot
pip install -r requirements.txt --quiet
uvicorn app.main:app --host 0.0.0.0 --port 8000
