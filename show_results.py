import requests
import json

files = {
    "835": "78427086-74e7-46da-9df9-013a0d12c651",
    "834": "f5c5a1e9-e93c-4d97-9e27-dd50ca11a337",
    "837i": "2d64847a-0d9f-493c-9e00-cf9fe8c14cdd",
    "837p": "d2bd3127-5980-4ed9-b208-4384bedbbef9"
}

print("="*80)
print("DETAILED RESULTS - VALIDEDI v0.3.0")
print("="*80)

for tx_type, file_id in files.items():
    print(f"\n### {tx_type.upper()} ###")
    r = requests.get(f"http://localhost:8000/api/files/{file_id}/parse-result")
    data = r.json()
    
    print(f"Transaction: {data.get('transaction_set')}")
    print(f"Sender: {data.get('sender_id')}")
    print(f"Date: {data.get('interchange_date')}")
    print(f"Segments: {data.get('segment_count')}")
    
    raw_json = data.get("raw_json", {})
    print(f"\nHas Structured Data: {'structured_data' in raw_json}")
    print(f"Has JSON Export: {'json_export' in raw_json}")
    
    if "structured_data" in raw_json and raw_json["structured_data"]:
        sd = raw_json["structured_data"]
        if tx_type == "835":
            amt = sd.get("payment_summary", {}).get("total_amount", 0)
            print(f"  Payment Amount: ${amt:.2f}")
            print(f"  Claims: {len(sd.get('claims', []))}")
        elif tx_type == "834":
            print(f"  Members: {len(sd.get('members', []))}")
        elif tx_type in ("837i", "837p"):
            print(f"  Claims: {len(sd)}")
            if sd:
                print(f"  First Claim ID: {sd[0].get('claim_id')}")
                amt = sd[0].get("total_charge", 0)
                print(f"  First Claim Total: ${amt:.2f}")

print("\n" + "="*80)
