import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.auth.firebase_auth import get_current_user, UserContext

# Override dependency to mock an injected admin user
def override_get_current_user():
    return UserContext(
        uid="123",
        email="dusane.pratham@gmail.com",
        role="admin",
        permissions=["admin.full", "claims.view", "enrollment.view", "remittance.view"]
    )

app.dependency_overrides[get_current_user] = override_get_current_user
client = TestClient(app)

def main():
    response = client.get("/api/files?limit=1000")
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Returned {len(data)} files.")
    else:
        print(f"Response: {response.text}")

if __name__ == "__main__":
    main()
