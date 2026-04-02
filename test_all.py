import requests
import json

files = [
    ('835_remittance.edi', '835 Remittance'),
    ('834_enrollment.edi', '834 Enrollment'),
    ('837i_institutional.edi', '837I Institutional'),
    ('industry_standard.edi', '837P Professional')
]

print('='*80)
print('TESTING ALL EDI FILES WITH VALIDEDI v0.3.0')
print('='*80)

for filename, description in files:
    print(f'\n### {description} ({filename}) ###')
    try:
        with open(filename, 'rb') as f:
            r = requests.post('http://localhost:8000/api/upload', files={'file': (filename, f)})
        
        if r.status_code == 200:
            data = r.json()
            print(f'Status: {r.status_code}')
            print(f'Type: {data.get("transaction_type")}')
            print(f'Valid: {data.get("is_valid")}')
            print(f'Errors: {data.get("error_count")}')
            print(f'ID: {data.get("id")}')
        else:
            print(f'Failed: {r.status_code}')
    except Exception as e:
        print(f'Error: {e}')

print('\n' + '='*80)
