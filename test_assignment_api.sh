#!/bin/bash

# Test Assignment Generation API

echo "🧪 Testing Assignment Generation API..."
echo ""

USER_ID="user_1766393325095_d2c53d0"
API_URL="http://localhost:8000/api/ai/assignments/generate-milestone"

echo "📝 Generating assignment for 'Introduction to Stoicism'..."
echo ""

curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"milestone_title\": \"Introduction to Stoicism\",
    \"milestone_description\": \"Exploring the foundations of Stoicism and its key philosophers.\",
    \"concepts\": [\"Zeno of Citium\", \"Stoa Poikile\", \"Logos\", \"Virtue Ethics\"],
    \"learning_steps\": [
      {
        \"order\": 1,
        \"title\": \"Origins of Stoicism\",
        \"description\": \"Introduction to the Stoic philosophy and its origins.\",
        \"learning_objectives\": [\"Understand the historical context\", \"Identify key figures\"],
        \"key_concepts\": [\"Zeno of Citium\", \"Stoa Poikile\"]
      }
    ],
    \"difficulty\": \"intermediate\"
  }" | jq '.'

echo ""
echo "✅ Test complete!"
