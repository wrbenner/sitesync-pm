#!/bin/bash
# SiteSync PM Edge Functions - Example API Calls
# These examples show how to call each edge function

# Configuration
PROJECT_URL="https://your-project.supabase.co"
JWT_TOKEN="your-jwt-token-here"
CRON_SECRET="your-cron-secret-here"
PROJECT_ID="550e8400-e29b-41d4-a716-446655440000"

echo "================================"
echo "SiteSync PM Edge Functions"
echo "Example API Calls"
echo "================================"
echo ""

# ============================================================================
# 1. AI COPILOT - Conversational Assistant
# ============================================================================
echo "1. AI COPILOT - Conversational Assistant"
echo "=========================================="
echo ""
echo "Request:"
curl -X POST "${PROJECT_URL}/functions/v1/ai-copilot" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the status of the concrete foundation pour?",
    "project_id": "'${PROJECT_ID}'",
    "conversation_id": ""
  }' \
  -w "\nStatus: %{http_code}\n"

echo ""
echo "Response format:"
echo '{
  "response": "The concrete pour for the foundation...",
  "conversation_id": "uuid",
  "tokens_used": 1240
}'
echo ""
echo ""

# ============================================================================
# 2. AI RFI DRAFT - Generate RFI from Field Notes
# ============================================================================
echo "2. AI RFI DRAFT - Generate RFI from Field Notes"
echo "=============================================="
echo ""
echo "Request:"
curl -X POST "${PROJECT_URL}/functions/v1/ai-rfi-draft" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "The drywall in the mechanical room has visible cracks and doesnt meet the specification.",
    "photo_url": "https://example.com/photos/crack.jpg",
    "drawing_ref": "A-3.2",
    "project_id": "'${PROJECT_ID}'"
  }' \
  -w "\nStatus: %{http_code}\n"

echo ""
echo "Response format:"
echo '{
  "subject": "Drywall crack mitigation in mechanical room",
  "question": "Should we repair the drywall cracks per specification 09 21 16 or replace the section?",
  "suggested_assignee": "Architect",
  "spec_section": "09 21 16"
}'
echo ""
echo ""

# ============================================================================
# 3. AI DAILY SUMMARY - Generate Daily Narrative
# ============================================================================
echo "3. AI DAILY SUMMARY - Generate Daily Narrative"
echo "=============================================="
echo ""
echo "Request:"
curl -X POST "${PROJECT_URL}/functions/v1/ai-daily-summary" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "'${PROJECT_ID}'",
    "date": "2026-04-01"
  }' \
  -w "\nStatus: %{http_code}\n"

echo ""
echo "Response format:"
echo '{
  "summary": "On April 1st, the masonry crew completed 85% of the first floor exterior walls despite cooler temperatures. The concrete pour on the foundation continued ahead of schedule. One RFI response was received regarding MEP penetrations...",
  "highlights": [
    "Masonry crew completed 85% of first floor exterior",
    "Concrete curing ahead of schedule",
    "No safety incidents reported"
  ],
  "concerns": [
    "MEP coordinator delayed submittal response by 2 days",
    "Cold weather may impact mortar curing rates"
  ]
}'
echo ""
echo ""

# ============================================================================
# 4. AI SCHEDULE RISK - Analyze Schedule for Delays
# ============================================================================
echo "4. AI SCHEDULE RISK - Analyze Schedule for Delays"
echo "================================================="
echo ""
echo "Request:"
curl -X POST "${PROJECT_URL}/functions/v1/ai-schedule-risk" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "'${PROJECT_ID}'"
  }' \
  -w "\nStatus: %{http_code}\n"

echo ""
echo "Response format:"
echo '{
  "risks": [
    {
      "activity_id": "phase-003",
      "activity_name": "Roof Installation",
      "risk_level": "high",
      "probability": 0.75,
      "impact_days": 7,
      "reason": "Weather forecast shows 60% chance of rain during scheduled period. Crew availability at 68%.",
      "mitigation": "Secure additional crew or defer to April 8-10 window with better forecast"
    },
    {
      "activity_id": "phase-005",
      "activity_name": "Exterior Siding",
      "risk_level": "medium",
      "probability": 0.45,
      "impact_days": 3,
      "reason": "Open RFI on material specification may impact delivery timeline",
      "mitigation": "Expedite RFI response from architect to confirm selections"
    }
  ]
}'
echo ""
echo ""

# ============================================================================
# 5. AI CONFLICT DETECTION - Detect Timeline Conflicts
# ============================================================================
echo "5. AI CONFLICT DETECTION - Detect Timeline Conflicts"
echo "===================================================="
echo ""
echo "Request:"
curl -X POST "${PROJECT_URL}/functions/v1/ai-conflict-detection" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "'${PROJECT_ID}'"
  }' \
  -w "\nStatus: %{http_code}\n"

echo ""
echo "Response format:"
echo '{
  "conflicts": [
    {
      "type": "submittal_lead_time",
      "severity": "critical",
      "description": "Structural steel submittal due 3/28 but installation scheduled 4/1 with only 4 days for architect approval",
      "affected_items": ["Structural Steel Supplier", "Installation Phase"],
      "recommendation": "Accelerate submittal to 3/20 or defer installation to 4/8 post-approval"
    },
    {
      "type": "rfi_dependency",
      "severity": "major",
      "description": "Open RFI on electrical layout affects panel installation scheduled 4/3",
      "affected_items": ["RFI-0047", "Electrical Panel Installation"],
      "recommendation": "Prioritize RFI response or delay panel installation pending answer"
    }
  ]
}'
echo ""
echo ""

# ============================================================================
# 6. WEATHER SYNC - Update Weather Cache
# ============================================================================
echo "6. WEATHER SYNC - Update Weather Cache (CRON-only)"
echo "=================================================="
echo ""
echo "Request:"
curl -X POST "${PROJECT_URL}/functions/v1/weather-sync" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "'${PROJECT_ID}'"
  }' \
  -w "\nStatus: %{http_code}\n"

echo ""
echo "Response format:"
echo '{
  "cached": true,
  "forecast_days": 10
}'
echo ""
echo ""

# ============================================================================
# MULTI-TURN CONVERSATION EXAMPLE
# ============================================================================
echo "7. MULTI-TURN CONVERSATION - Example Flow"
echo "========================================="
echo ""
echo "Turn 1 (initial message):"
CONV_ID=$(curl -s -X POST "${PROJECT_URL}/functions/v1/ai-copilot" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What activities are critical path?",
    "project_id": "'${PROJECT_ID}'"
  }' | jq -r '.conversation_id')

echo "Conversation ID: ${CONV_ID}"
echo ""

echo "Turn 2 (follow-up using conversation_id):"
curl -X POST "${PROJECT_URL}/functions/v1/ai-copilot" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What weather risks could delay those?",
    "project_id": "'${PROJECT_ID}'",
    "conversation_id": "'${CONV_ID}'"
  }' \
  -w "\nStatus: %{http_code}\n"

echo ""
echo ""

# ============================================================================
# ERROR HANDLING EXAMPLES
# ============================================================================
echo "8. ERROR HANDLING - Example Error Responses"
echo "=========================================="
echo ""
echo "Missing JWT:"
curl -X POST "${PROJECT_URL}/functions/v1/ai-copilot" \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "project_id": "'${PROJECT_ID}'"}' \
  -w "\nStatus: %{http_code}\n"

echo ""
echo "Invalid project_id (not a UUID):"
curl -X POST "${PROJECT_URL}/functions/v1/ai-copilot" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "test",
    "project_id": "not-a-uuid"
  }' \
  -w "\nStatus: %{http_code}\n"

echo ""
echo "Empty message:"
curl -X POST "${PROJECT_URL}/functions/v1/ai-copilot" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "",
    "project_id": "'${PROJECT_ID}'"
  }' \
  -w "\nStatus: %{http_code}\n"

echo ""
echo ""
echo "================================"
echo "For complete documentation, see:"
echo "  - EDGE_FUNCTIONS_GUIDE.md"
echo "  - QUICK_REFERENCE.md"
echo "================================"
