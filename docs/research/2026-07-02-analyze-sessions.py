# -*- coding: utf-8 -*-
"""Moved to scripts/analyze-sessions.py; this shim keeps old cron entries and
doc links working. Do not add analysis logic here."""
import os
import runpy
import sys

NEW = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "scripts", "analyze-sessions.py")
)
sys.stderr.write("analyze-sessions.py moved to scripts/; running %s\n" % NEW)
runpy.run_path(NEW, run_name="__main__")
