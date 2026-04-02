import asyncio, asyncpg, ssl

async def clear():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    conn = await asyncpg.connect(
        host='validedi-db.c3ky824euz65.ap-south-1.rds.amazonaws.com',
        port=5432, user='validedi_user', password='Valid123#',
        database='postgres', ssl=ctx
    )
    await conn.execute('TRUNCATE validation_errors, parse_results, edi_files CASCADE')
    print('All tables cleared.')
    await conn.close()

asyncio.run(clear())
