import sys
sys.path.insert(0, 'C:/Users/Admin/.kiro/CleanEDI/backend')

from validedi import parse, validate
from validedi.llm import explain

filepath = sys.argv[1] if len(sys.argv) > 1 else 'C:/Users/Admin/.kiro/CleanEDI/test_sample.edi'

print(f"\nReading: {filepath}\n")

# Parse and validate
edi = parse(filepath)
val = validate(filepath)

# --- Envelope Summary ---
env = edi.envelope
print("=" * 70)
print("ENVELOPE")
print("=" * 70)
print(f"  Transaction Type : {env.transaction_type}")
print(f"  Sender ID        : {env.sender_id.strip()}")
print(f"  Receiver ID      : {env.receiver_id.strip()}")
print(f"  Date             : {env.interchange_date}")
print(f"  Time             : {env.interchange_time}")
print(f"  Version          : {env.version}")
print(f"  Control Number   : {env.isa_control_number}")

# --- Validation Summary ---
print("\n" + "=" * 70)
print("VALIDATION")
print("=" * 70)
print(f"  Valid            : {'? Yes' if val.is_valid else '? No'}")
print(f"  Errors           : {val.error_count}")
print(f"  Warnings         : {val.warning_count}")

if val.errors:
    print("\n  Error Details:")
    for e in val.errors:
        print(f"    [{e.severity.upper()}] {e.code} @ {e.segment} pos {e.position}")
        print(f"    ? {e.message}")

# --- Loop Structure ---
print("\n" + "=" * 70)
print("LOOP STRUCTURE")
print("=" * 70)

def print_loop(loop, indent=0):
    pad = "  " * indent
    seg_ids = [s.segment_id for s in loop.segments]
    print(f"{pad}Loop {loop.loop_id}  [{', '.join(seg_ids)}]")

    # Print each segment's elements
    for seg in loop.segments:
        vals = [e.raw for e in seg.elements]
        print(f"{pad}  {seg.segment_id}: {' | '.join(vals)}")

    for child in loop.children:
        print_loop(child, indent + 1)

for loop in edi.loops:
    print_loop(loop)

# --- Transaction-specific extraction ---
tx = env.transaction_type.upper()

print("\n" + "=" * 70)
print(f"EXTRACTED DATA ({tx})")
print("=" * 70)

def find_all_loops(loops, loop_id):
    found = []
    for loop in loops:
        if loop.loop_id == loop_id:
            found.append(loop)
        found.extend(find_all_loops(loop.children, loop_id))
    return found

def find_all_segments(loops, seg_id):
    found = []
    for loop in loops:
        found.extend(loop.find_all(seg_id))
        found.extend(find_all_segments(loop.children, seg_id))
    return found

if "837" in tx:
    claims = find_all_loops(edi.loops, "2300")
    print(f"  Claims found: {len(claims)}")
    for i, claim_loop in enumerate(claims, 1):
        clm = claim_loop.find_segment("CLM")
        if clm:
            print(f"\n  Claim #{i}")
            print(f"    Claim ID     : {clm.get_value(1)}")
            print(f"    Billed Amount: ${clm.get_value(2)}")
        for child in claim_loop.children:
            if child.loop_id == "2400":
                sv1 = child.find_segment("SV1")
                if sv1:
                    print(f"    Service Line : {sv1.get_value(1)} — ${sv1.get_value(2)}")

elif tx == "835":
    bprs = find_all_segments(edi.loops, "BPR")
    for bpr in bprs:
        print(f"  Payment Amount : ${bpr.get_value(2)}")
        print(f"  Payment Date   : {bpr.get_value(16)}")
    clps = find_all_loops(edi.loops, "2100")
    print(f"\n  Claim Payments: {len(clps)}")
    for clp_loop in clps:
        clp = clp_loop.find_segment("CLP")
        if clp:
            print(f"    Claim {clp.get_value(1)}: Billed ${clp.get_value(3)}, Paid ${clp.get_value(4)}")

elif tx == "834":
    members = find_all_loops(edi.loops, "2000")
    print(f"  Members found: {len(members)}")
    for m in members:
        nm1 = m.find_segment("NM1")
        if nm1:
            print(f"    Member: {nm1.get_value(3)} {nm1.get_value(4)}")

# --- Plain English Report ---
print("\n" + "=" * 70)
print("PLAIN ENGLISH REPORT")
print("=" * 70)
result = explain(edi, val, force_rule_based=True)
print(result.report)
