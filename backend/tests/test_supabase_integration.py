"""
Integration tests for Supabase cloud connection and all tables.

Tests:
1. Basic connection and authentication
2. All new tables (stores, user_profiles, reviews, transit_routes, agent_traces)
3. Geo functions (find_stores_within_radius)
4. Marketplace service integration (requests, offers)
5. RLS policies (service role access)
"""
import pytest
import uuid
from datetime import datetime, timedelta

from app.models.db import get_db
from app.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY


# ============================================================================
# 1. CONNECTION TESTS
# ============================================================================

class TestSupabaseConnection:
    """Test basic Supabase connection and configuration."""

    def test_env_variables_configured(self):
        """Verify environment variables are set."""
        assert SUPABASE_URL, "SUPABASE_URL not configured in .env"
        assert SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY not configured in .env"
        assert "supabase.co" in SUPABASE_URL, "SUPABASE_URL should point to supabase.co"

    def test_client_connects_successfully(self):
        """Verify Supabase client can be created."""
        db = get_db()
        assert db is not None, "Failed to create Supabase client"

    def test_can_query_database(self):
        """Verify basic database query works."""
        db = get_db()
        # Query the stores table (should have seed data)
        result = db.table("stores").select("count").limit(1).execute()
        assert result is not None, "Query failed"


# ============================================================================
# 2. STORES TABLE TESTS (with seed data)
# ============================================================================

class TestStoresTable:
    """Test stores table and seed data."""

    def test_seed_data_exists(self):
        """Verify demo seed data was loaded."""
        db = get_db()
        result = db.table("stores").select("*").eq("is_seed_data", True).execute()
        
        assert result.data, "No seed data found in stores table"
        assert len(result.data) >= 15, f"Expected at least 15 seed stores, got {len(result.data)}"

    def test_seed_stores_have_required_fields(self):
        """Verify seed stores have all required fields."""
        db = get_db()
        result = db.table("stores").select("*").eq("is_seed_data", True).limit(1).execute()
        
        store = result.data[0]
        required_fields = ["id", "place_id", "name", "category", "rating", "is_seed_data"]
        for field in required_fields:
            assert field in store, f"Missing required field: {field}"

    def test_stores_categories_diversity(self):
        """Verify we have diverse categories in seed data."""
        db = get_db()
        result = db.table("stores").select("category").eq("is_seed_data", True).execute()
        
        categories = set(s["category"] for s in result.data)
        assert len(categories) >= 5, f"Expected at least 5 categories, got {categories}"

    def test_geo_function_find_stores_within_radius(self):
        """Test the PostGIS geo function works."""
        db = get_db()
        # Query stores near Zurich HB (47.3769, 8.5417)
        result = db.rpc(
            "find_stores_within_radius",
            {"p_lat": 47.3769, "p_lng": 8.5417, "p_radius_km": 5.0, "p_limit_count": 10}
        ).execute()
        
        assert result.data, "Geo function returned no results"
        assert len(result.data) > 0, "Expected at least one store within 5km of Zurich HB"
        
        # Verify distance_km is calculated
        first_store = result.data[0]
        assert "distance_km" in first_store, "distance_km not returned by geo function"

    def test_geo_function_with_category_filter(self):
        """Test geo function with category filter."""
        db = get_db()
        result = db.rpc(
            "find_stores_within_radius",
            {
                "p_lat": 47.3769,
                "p_lng": 8.5417,
                "p_radius_km": 10.0,
                "p_category_filter": "restaurant",
                "p_limit_count": 50
            }
        ).execute()
        
        assert result.data, "No restaurants found"
        for store in result.data:
            assert store["category"] == "restaurant", f"Expected restaurant, got {store['category']}"


# ============================================================================
# 3. USER PROFILES TABLE TESTS
# ============================================================================

class TestUserProfilesTable:
    """Test user_profiles table operations."""

    def test_demo_user_exists(self):
        """Verify demo user profile was created."""
        db = get_db()
        result = db.table("user_profiles").select("*").eq("user_id", "demo-user-001").execute()
        
        assert result.data, "Demo user profile not found"
        profile = result.data[0]
        assert profile["persona"] == "student"
        assert profile["budget_level"] == "budget"

    def test_create_and_read_user_profile(self):
        """Test creating and reading a user profile."""
        db = get_db()
        test_user_id = f"test-user-{uuid.uuid4().hex[:8]}"
        
        # Create
        profile_data = {
            "user_id": test_user_id,
            "persona": "professional",
            "budget_level": "premium",
            "weight_price": 0.2,
            "weight_distance": 0.3,
            "weight_rating": 0.3,
            "weight_transit": 0.2,
            "language": "de",
            "onboarding_completed": True
        }
        
        try:
            db.table("user_profiles").insert(profile_data).execute()
            
            # Read back
            result = db.table("user_profiles").select("*").eq("user_id", test_user_id).execute()
            assert result.data, "Failed to read created profile"
            
            profile = result.data[0]
            assert profile["persona"] == "professional"
            assert profile["budget_level"] == "premium"
            assert profile["language"] == "de"
        finally:
            # Cleanup
            db.table("user_profiles").delete().eq("user_id", test_user_id).execute()

    def test_user_profile_weight_constraints(self):
        """Verify weight constraints are enforced."""
        db = get_db()
        test_user_id = f"test-user-{uuid.uuid4().hex[:8]}"
        
        # Try to create with invalid weight (> 1.0)
        invalid_profile = {
            "user_id": test_user_id,
            "weight_price": 1.5,  # Invalid: > 1.0
        }
        
        with pytest.raises(Exception):
            db.table("user_profiles").insert(invalid_profile).execute()


# ============================================================================
# 4. REVIEW SUMMARIES TABLE TESTS
# ============================================================================

class TestReviewSummariesTable:
    """Test review_summaries table operations."""

    def test_seed_review_summaries_exist(self):
        """Verify seed review summaries were created."""
        db = get_db()
        result = db.table("review_summaries").select("*").execute()
        
        assert result.data, "No review summaries found"
        assert len(result.data) >= 1, "Expected at least one review summary"

    def test_review_summary_structure(self):
        """Verify review summary has correct structure."""
        db = get_db()
        result = db.table("review_summaries").select("*").limit(1).execute()
        
        summary = result.data[0]
        assert "advantages" in summary
        assert "disadvantages" in summary
        assert "sentiment_score" in summary
        assert isinstance(summary["advantages"], list)


# ============================================================================
# 5. REQUESTS & OFFERS TABLES (Marketplace Integration)
# ============================================================================

class TestMarketplaceIntegration:
    """Test requests and offers tables through marketplace service."""

    def test_create_request_via_service(self):
        """Test creating a request through the marketplace service."""
        from app.services import marketplace
        
        test_request_id = str(uuid.uuid4())
        request_data = {
            "id": test_request_id,
            "raw_input": "Integration test - find me a haircut",
            "category": "hair_salon",
            "requested_time": datetime.utcnow().isoformat() + "Z",
            "location": {"lat": 47.3769, "lng": 8.5417},
            "radius_km": 5.0,
            "constraints": {"max_price": 50},
            "status": "open"
        }
        
        try:
            # Create via service
            result_id = marketplace.persist_request(request_data)
            assert result_id == test_request_id
            
            # Read back via service
            saved = marketplace.get_request(test_request_id)
            assert saved is not None
            assert saved["raw_input"] == "Integration test - find me a haircut"
            assert saved["category"] == "hair_salon"
        finally:
            # Cleanup
            db = get_db()
            db.table("requests").delete().eq("id", test_request_id).execute()

    def test_create_offers_via_service(self):
        """Test creating offers through the marketplace service."""
        from app.services import marketplace
        
        test_request_id = str(uuid.uuid4())
        request_data = {
            "id": test_request_id,
            "raw_input": "Integration test - offers",
            "category": "test",
            "requested_time": datetime.utcnow().isoformat() + "Z",
            "location": {"lat": 47.37, "lng": 8.54},
            "status": "open"
        }
        
        try:
            marketplace.persist_request(request_data)
            
            # Create offers
            offers = [
                {
                    "id": str(uuid.uuid4()),
                    "request_id": test_request_id,
                    "provider_id": "provider-1",
                    "price": 35.0,
                    "eta_minutes": 15,
                    "slot_time": (datetime.utcnow() + timedelta(hours=1)).isoformat() + "Z",
                    "score": 0.85,
                    "reasons": ["Good rating", "Close by"]
                },
                {
                    "id": str(uuid.uuid4()),
                    "request_id": test_request_id,
                    "provider_id": "provider-2",
                    "price": 45.0,
                    "eta_minutes": 20,
                    "slot_time": (datetime.utcnow() + timedelta(hours=1)).isoformat() + "Z",
                    "score": 0.75,
                    "reasons": ["Premium quality"]
                }
            ]
            
            marketplace.persist_offers(offers)
            
            # Read back
            saved_offers = marketplace.get_offers(test_request_id)
            assert len(saved_offers) == 2
            # Should be ordered by score desc
            assert saved_offers[0]["score"] >= saved_offers[1]["score"]
        finally:
            # Cleanup (cascade will delete offers)
            db = get_db()
            db.table("requests").delete().eq("id", test_request_id).execute()


# ============================================================================
# 6. AGENT TRACES TABLE TESTS
# ============================================================================

class TestAgentTracesTable:
    """Test agent_traces tables for debugging/observability."""

    def test_create_trace(self):
        """Test creating an agent trace."""
        db = get_db()
        trace_id = f"trace-{uuid.uuid4().hex[:8]}"
        
        trace_data = {
            "trace_id": trace_id,
            "status": "running",
            "stores_found": 0,
            "offers_generated": 0
        }
        
        try:
            db.table("agent_traces").insert(trace_data).execute()
            
            # Read back
            result = db.table("agent_traces").select("*").eq("trace_id", trace_id).execute()
            assert result.data
            assert result.data[0]["status"] == "running"
        finally:
            db.table("agent_traces").delete().eq("trace_id", trace_id).execute()

    def test_create_trace_nodes(self):
        """Test creating trace nodes for agents."""
        db = get_db()
        trace_id = f"trace-{uuid.uuid4().hex[:8]}"
        
        try:
            # Create parent trace
            trace_data = {"trace_id": trace_id, "status": "running"}
            result = db.table("agent_traces").insert(trace_data).execute()
            trace_uuid = result.data[0]["id"]
            
            # Create trace nodes
            nodes = [
                {
                    "trace_id": trace_uuid,
                    "agent_name": "input_agent",
                    "execution_order": 1,
                    "status": "completed",
                    "duration_ms": 150,
                    "input_summary": {"raw_input": "test query"},
                    "output_summary": {"category": "hair_salon"}
                },
                {
                    "trace_id": trace_uuid,
                    "agent_name": "crawling_store_search",
                    "execution_order": 2,
                    "status": "completed",
                    "duration_ms": 2500,
                    "depends_on": ["input_agent"]
                }
            ]
            
            db.table("agent_trace_nodes").insert(nodes).execute()
            
            # Read back
            result = db.table("agent_trace_nodes").select("*").eq("trace_id", trace_uuid).order("execution_order").execute()
            assert len(result.data) == 2
            assert result.data[0]["agent_name"] == "input_agent"
            assert result.data[1]["agent_name"] == "crawling_store_search"
        finally:
            db.table("agent_traces").delete().eq("trace_id", trace_id).execute()

    def test_get_trace_summary_function(self):
        """Test the get_trace_summary RPC function."""
        db = get_db()
        trace_id = f"trace-{uuid.uuid4().hex[:8]}"
        
        try:
            # Create trace with nodes
            trace_data = {"trace_id": trace_id, "status": "completed", "total_duration_ms": 5000}
            result = db.table("agent_traces").insert(trace_data).execute()
            trace_uuid = result.data[0]["id"]
            
            node = {
                "trace_id": trace_uuid,
                "agent_name": "input_agent",
                "execution_order": 1,
                "status": "completed",
                "duration_ms": 100
            }
            db.table("agent_trace_nodes").insert(node).execute()
            
            # Call RPC function
            summary = db.rpc("get_trace_summary", {"p_trace_id": trace_id}).execute()
            
            assert summary.data is not None
            assert summary.data["trace_id"] == trace_id
            assert summary.data["status"] == "completed"
            assert summary.data["nodes"] is not None
        finally:
            db.table("agent_traces").delete().eq("trace_id", trace_id).execute()


# ============================================================================
# 7. TRANSIT ROUTES CACHE TABLE TESTS
# ============================================================================

class TestTransitRoutesTable:
    """Test transit_routes cache table."""

    def test_create_transit_route(self):
        """Test creating a cached transit route."""
        db = get_db()
        route_id = None
        
        try:
            route_data = {
                "origin_lat": 47.3769,
                "origin_lng": 8.5417,
                "destination_lat": 47.3667,
                "destination_lng": 8.5450,
                "departure_time": datetime.utcnow().isoformat() + "Z",
                "duration_minutes": 12,
                "transport_types": ["tram", "walk"],
                "time_label": "open"
            }
            
            result = db.table("transit_routes").insert(route_data).execute()
            route_id = result.data[0]["id"]
            
            # Read back
            saved = db.table("transit_routes").select("*").eq("id", route_id).execute()
            assert saved.data
            assert saved.data[0]["duration_minutes"] == 12
            assert "tram" in saved.data[0]["transport_types"]
        finally:
            if route_id:
                db.table("transit_routes").delete().eq("id", route_id).execute()


# ============================================================================
# 8. END-TO-END FLOW TEST
# ============================================================================

class TestEndToEndFlow:
    """Test a complete request-to-offers flow."""

    def test_full_request_flow(self):
        """
        Simulate a complete flow:
        1. Query stores via geo function
        2. Create a request
        3. Create offers from store results
        4. Read back via marketplace service
        """
        from app.services import marketplace
        
        db = get_db()
        test_request_id = str(uuid.uuid4())
        
        try:
            # 1. Find stores near Zurich HB
            stores = db.rpc(
                "find_stores_within_radius",
                {"p_lat": 47.3769, "p_lng": 8.5417, "p_radius_km": 3.0, "p_category_filter": "hair_salon", "p_limit_count": 5}
            ).execute()
            
            assert stores.data, "No hair salons found for test"
            
            # 2. Create request
            request_data = {
                "id": test_request_id,
                "raw_input": "E2E test - haircut near HB",
                "category": "hair_salon",
                "requested_time": datetime.utcnow().isoformat() + "Z",
                "location": {"lat": 47.3769, "lng": 8.5417},
                "radius_km": 3.0,
                "status": "open"
            }
            marketplace.persist_request(request_data)
            
            # 3. Create offers from stores
            offers = []
            for i, store in enumerate(stores.data[:3]):
                offers.append({
                    "id": str(uuid.uuid4()),
                    "request_id": test_request_id,
                    "provider_id": store["place_id"],
                    "price": 40.0 + i * 10,
                    "eta_minutes": int(store["distance_km"] * 10) + 5,
                    "slot_time": (datetime.utcnow() + timedelta(hours=1)).isoformat() + "Z",
                    "score": 0.9 - i * 0.1,
                    "reasons": [f"Rating: {store['rating']}", f"Distance: {store['distance_km']:.2f}km"]
                })
            
            marketplace.persist_offers(offers)
            
            # 4. Read back complete result
            saved_request = marketplace.get_request(test_request_id)
            saved_offers = marketplace.get_offers(test_request_id)
            
            assert saved_request is not None
            assert saved_request["category"] == "hair_salon"
            assert len(saved_offers) == len(offers)
            assert saved_offers[0]["score"] >= saved_offers[-1]["score"]  # Sorted by score
            
            print(f"\n[OK] E2E Test Success:")
            print(f"   - Found {len(stores.data)} stores")
            print(f"   - Created request: {test_request_id[:8]}...")
            print(f"   - Created {len(offers)} offers")
            print(f"   - Top offer: {saved_offers[0]['provider_id']} (score: {saved_offers[0]['score']})")
            
        finally:
            db.table("requests").delete().eq("id", test_request_id).execute()


# ============================================================================
# RUN QUICK SMOKE TEST
# ============================================================================

if __name__ == "__main__":
    """Quick smoke test - run directly with: python -m tests.test_supabase_integration"""
    print("=" * 60)
    print("SUPABASE INTEGRATION SMOKE TEST")
    print("=" * 60)
    
    # Test connection
    print("\n1. Testing connection...")
    try:
        db = get_db()
        print("   [OK] Connected to Supabase")
    except Exception as e:
        print(f"   [FAIL] Connection failed: {e}")
        exit(1)
    
    # Test stores
    print("\n2. Testing stores table...")
    try:
        result = db.table("stores").select("name, category, rating").eq("is_seed_data", True).limit(5).execute()
        print(f"   [OK] Found {len(result.data)} seed stores")
        for s in result.data[:3]:
            print(f"      - {s['name']} ({s['category']}) rating={s['rating']}")
    except Exception as e:
        print(f"   [FAIL] Failed: {e}")
    
    # Test geo function
    print("\n3. Testing geo function...")
    try:
        result = db.rpc(
            "find_stores_within_radius",
            {"p_lat": 47.3769, "p_lng": 8.5417, "p_radius_km": 2.0, "p_limit_count": 5}
        ).execute()
        print(f"   [OK] Geo query returned {len(result.data)} stores within 2km")
        for s in result.data[:3]:
            print(f"      - {s['name']} ({s['distance_km']:.2f}km)")
    except Exception as e:
        print(f"   [FAIL] Failed: {e}")
    
    # Test user profiles
    print("\n4. Testing user_profiles table...")
    try:
        result = db.table("user_profiles").select("*").eq("user_id", "demo-user-001").execute()
        if result.data:
            print(f"   [OK] Demo user found: {result.data[0]['persona']} / {result.data[0]['budget_level']}")
        else:
            print("   [WARN] Demo user not found")
    except Exception as e:
        print(f"   [FAIL] Failed: {e}")
    
    # Test marketplace
    print("\n5. Testing marketplace service...")
    try:
        from app.services import marketplace
        test_id = str(uuid.uuid4())
        req = {
            "id": test_id,
            "raw_input": "smoke test",
            "category": "test",
            "requested_time": datetime.utcnow().isoformat() + "Z",
            "location": {"lat": 47.37, "lng": 8.54},
            "status": "pending"
        }
        marketplace.persist_request(req)
        saved = marketplace.get_request(test_id)
        db.table("requests").delete().eq("id", test_id).execute()
        print(f"   [OK] Marketplace service works (created & deleted test request)")
    except Exception as e:
        print(f"   [FAIL] Failed: {e}")
    
    print("\n" + "=" * 60)
    print("SMOKE TEST COMPLETE")
    print("=" * 60)
