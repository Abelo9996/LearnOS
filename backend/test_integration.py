#!/usr/bin/env python3
"""
Integration test for LearnOS enhanced features.
Tests the new personalization endpoints.
"""

import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_onboarding_flow():
    """Test the complete onboarding flow."""
    print("\n=== Testing Onboarding Flow ===")
    
    # Start onboarding
    print("1. Starting onboarding...")
    response = requests.post(f"{BASE_URL}/onboarding/start", json={
        "user_id": "test_user_123"
    })
    assert response.status_code == 200, f"Failed to start onboarding: {response.text}"
    
    data = response.json()
    session_id = data["session_id"]
    questions = data["questions"]
    
    print(f"   ✓ Got {len(questions)} questions")
    print(f"   ✓ Session ID: {session_id}")
    
    # Prepare sample responses
    responses = []
    for q in questions:
        response_value = None
        if q["question_type"] == "multiple_choice":
            response_value = q["options"][0]  # Pick first option
        elif q["question_type"] == "scale":
            response_value = "3"  # Middle of scale
        elif q["question_type"] == "text":
            response_value = "I want to learn reinforcement learning for robotics"
        
        responses.append({
            "question_id": q["id"],
            "answer": response_value
        })
    
    print("2. Submitting responses...")
    response = requests.post(f"{BASE_URL}/onboarding/submit", json={
        "session_id": session_id,
        "responses": responses
    })
    assert response.status_code == 200, f"Failed to submit onboarding: {response.text}"
    
    data = response.json()
    profile = data["profile"]
    insights = data["insights"]
    
    print(f"   ✓ Profile created:")
    print(f"     - Learning style: {profile['learning_style']}")
    print(f"     - Expertise level: {profile['expertise_level']}")
    print(f"     - Assessment style: {profile['assessment_style']}")
    print(f"     - Attention span: {profile['current_attention_minutes']} minutes")
    print(f"   ✓ Insights: {len(insights)} items")
    
    return "test_user_123"

def test_assignment_generation(user_id):
    """Test assignment generation."""
    print("\n=== Testing Assignment Generation ===")
    
    print("1. Generating assignment for 'Markov Decision Process'...")
    response = requests.post(f"{BASE_URL}/assignments/generate", json={
        "concept": "Markov Decision Process",
        "user_id": user_id
    })
    assert response.status_code == 200, f"Failed to generate assignment: {response.text}"
    
    data = response.json()
    assignment = data["assignment"]
    
    print(f"   ✓ Assignment created:")
    print(f"     - Type: {assignment['assignment_type']}")
    print(f"     - Estimated time: {assignment['estimated_hours']}h")
    print(f"     - Has starter code: {'starter_code' in assignment and assignment['starter_code'] is not None}")
    print(f"     - Rubric items: {len(assignment['rubric'])}")
    print(f"     - Hints: {len(assignment['hints'])}")
    
    # Test submission
    print("2. Submitting assignment solution...")
    response = requests.post(f"{BASE_URL}/assignments/submit", json={
        "assignment_id": assignment["id"],
        "user_id": user_id,
        "submitted_code": """
class GridWorldMDP:
    def __init__(self, size=5):
        self.size = size
        self.state = (0, 0)
        self.goal = (4, 4)
    
    def transition(self, action):
        # Move in the grid
        x, y = self.state
        if action == 'up' and y > 0:
            y -= 1
        elif action == 'down' and y < self.size - 1:
            y += 1
        # ... more actions
        self.state = (x, y)
        return self.get_reward()
    
    def get_reward(self):
        if self.state == self.goal:
            return 10
        return -1
""",
        "notes": "Implemented basic grid world with rewards"
    })
    assert response.status_code == 200, f"Failed to submit assignment: {response.text}"
    
    data = response.json()
    submission = data["submission"]
    
    print(f"   ✓ Submission received:")
    print(f"     - Score: {submission['score']}")
    print(f"     - Feedback: {submission['feedback'][:100]}...")
    print(f"     - Next steps: {data['next_steps']}")

def test_resource_curation(user_id):
    """Test resource curation."""
    print("\n=== Testing Resource Curation ===")
    
    print("1. Getting curated resources for 'Q-Learning'...")
    response = requests.post(f"{BASE_URL}/resources/curate", json={
        "concept": "Q-Learning",
        "user_id": user_id,
        "max_resources": 3
    })
    assert response.status_code == 200, f"Failed to curate resources: {response.text}"
    
    data = response.json()
    resources = data["resources"]
    primary = data["primary_resource"]
    
    print(f"   ✓ Found {len(resources)} resources")
    print(f"   ✓ Primary resource: {primary['title']}")
    print(f"     - Type: {primary['resource_type']}")
    print(f"     - Author: {primary.get('author', 'N/A')}")
    print(f"     - Difficulty: {primary['difficulty']}")
    print(f"     - Time: {primary['estimated_time_minutes']} minutes")
    print(f"     - Quality score: {primary['quality_score']}")
    
    print("\n   Supplementary resources:")
    for resource in data["supplementary_resources"]:
        print(f"     - {resource['title']} ({resource['resource_type']})")

def test_integrated_learning_flow():
    """Test a complete learning flow with all features."""
    print("\n=== Testing Integrated Learning Flow ===")
    
    # 1. Complete onboarding
    user_id = test_onboarding_flow()
    
    # 2. Generate assignment
    test_assignment_generation(user_id)
    
    # 3. Get curated resources
    test_resource_curation(user_id)
    
    print("\n" + "="*50)
    print("✓ All tests passed!")
    print("="*50)

if __name__ == "__main__":
    try:
        test_integrated_learning_flow()
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        exit(1)
    except requests.exceptions.ConnectionError:
        print("\n❌ Cannot connect to server. Make sure it's running on http://localhost:8000")
        exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
