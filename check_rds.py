import asyncio, asyncpg, ssl, json

async def check():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    conn = await asyncpg.connect(
        host='validedi-db.c3ky824euz65.ap-south-1.rds.amazonaws.com',
        port=5432, user='validedi_user', password='Valid123#',
        database='postgres', ssl=ctx
    )

    print("=" * 60)
    print("EDI_FILES")
    print("=" * 60)
    rows = await conn.fetch('SELECT id, filename, transaction_type, status, is_valid, error_count FROM edi_files')
    for r in rows:
        print(dict(r))

    print("\n" + "=" * 60)
    print("PARSE_RESULTS")
    print("=" * 60)
    rows = await conn.fetch('SELECT id, file_id, transaction_set, segment_count, raw_json FROM parse_results')
    for r in rows:
        d = dict(r)
        rj = d.pop('raw_json')
        print(d)
        print("raw_json ->")
        if isinstance(rj, dict):
            print(rj.get('report', rj))
        else:
            print(rj)

    print("\n" + "=" * 60)
    print("VALIDATION_ERRORS")
    print("=" * 60)
    rows = await conn.fetch('SELECT * FROM validation_errors')
    print(f"{len(rows)} rows")

    await conn.close()

asyncio.run(check())
