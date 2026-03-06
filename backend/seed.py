"""
Seed data for development — creates sample users and courses.
Run: python seed.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from models_db import init_models, async_session_factory, UserModel
from db import init_database
from datetime import datetime
import uuid


async def seed():
    print("🌱 Initializing database...")
    await init_models()
    await init_database()

    async with async_session_factory() as session:
        # Check if demo user exists
        from sqlalchemy import select
        result = await session.execute(select(UserModel).where(UserModel.email == "demo@learnos.ai"))
        if result.scalar_one_or_none():
            print("✅ Seed data already exists. Skipping.")
            return

        # Create demo user
        demo = UserModel(
            id=str(uuid.uuid4()),
            email="demo@learnos.ai",
            username="demo",
            display_name="Demo User",
            password_hash=None,
            role="learner",
            tier="free",
            email_verified=True,
            created_at=datetime.utcnow(),
        )
        session.add(demo)

        # Create admin user
        admin = UserModel(
            id=str(uuid.uuid4()),
            email="admin@learnos.ai",
            username="admin",
            display_name="Admin",
            password_hash=None,
            role="admin",
            tier="pro",
            email_verified=True,
            created_at=datetime.utcnow(),
        )
        session.add(admin)

        await session.commit()
        print("✅ Seed data created:")
        print(f"   Demo user: demo@learnos.ai")
        print(f"   Admin user: admin@learnos.ai")


if __name__ == "__main__":
    asyncio.run(seed())
