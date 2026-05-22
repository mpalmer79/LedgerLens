"""Test environment defaults.

Backend code now defaults to empty/in-memory values for env vars (see
ledgerlens.config), so these `setdefault` calls only matter when a test
explicitly checks env-driven behavior. They don't gate process startup
anymore.
"""

import os

os.environ.setdefault("ANTHROPIC_API_KEY", "")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
