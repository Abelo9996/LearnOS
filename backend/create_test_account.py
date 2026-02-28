"""
Quick script to create a test account for development
Run: python create_test_account.py
"""

import sys
import uuid
from datetime import datetime
from auth import AuthService, UserProfile, UserRole, UserTier
from database import Database

# Initialize
auth_service = AuthService()
db = Database()

# Create test user
test_user_id = str(uuid.uuid4())
test_email = "test@test.com"
test_password = "test"
test_username = "testuser"
test_display_name = "Test User"

# Hash the password
hashed_password = auth_service.hash_password(test_password)

# Create user profile with required fields
user = UserProfile(
    id=test_user_id,
    email=test_email,
    username=test_username,
    display_name=test_display_name,
    role=UserRole.LEARNER,
    tier=UserTier.FREE,
    is_active=True,
    email_verified=True,
    created_at=datetime.utcnow(),
    updated_at=datetime.utcnow()
)

# Save user to database
db.save_user(user)

# Save credentials
db.save_user_credential(test_email, test_user_id, hashed_password)

print("✅ Test account created successfully!")
print(f"\n📧 Email: {test_email}")
print(f"🔑 Password: {test_password}")
print(f"👤 Username: {test_username}")
print(f"👤 Display Name: {test_display_name}")
print(f"\nYou can now login at: http://localhost:3000/login")

