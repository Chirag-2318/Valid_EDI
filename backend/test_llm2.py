import asyncio
import os
from app.services.chat import ask_llm_fix_edi

raw = "ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *200101*1200*^*00501*000000001*0*T*:~GS*HC*SENDER*RECEIVER*200101*1200*1*X*005010X222A1~ST*837*0001*005010X222A1~BHT*0019*00*0123*200101*1200*CH~NM1*41*2*SENDER NAME*****46*123456789~PER*IC*CONTACT*TE*5555555555~NM1*40*2*RECEIVER NAME*****46*987654321~HL*1**20*1~NM1*85*2*PROVIDER NAME*****XX*1234567893~HL*2*1*22*0~SBR*P**123456******CI~NM1*IL*1*SMITH*JOHN****MI*123456789~CLM*123456*150.00***11:B:1*Y*A*Y*I~HI*ABK:J69HI HI~LX*1~SV1*HC:99213*0.00*UN*1***1~DTP*472*D8*200101~SE*18*0001~GE*1*1~IEA*1*000000001~"
errors = [
    {"code": "DIAGNOSIS_CODE_FORMAT", "message": "ICD-10 code J69HI HI does not match required format {full value: ABK:J69HI HI}", "segment": "HI"},
    {"code": "CHARGE_TOTAL_CHECK", "message": "Service line charges ($0.00) do not match claim total ($150.00)", "segment": "CLM"}
]

async def main():
    res = await ask_llm_fix_edi(raw, errors)
    print("FULL RES:", res)

asyncio.run(main())
