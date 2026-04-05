import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select, func
        from app.db_models import EDIFile
        allowed_types = {"837p", "837i", "834", "835"}
        q = select(EDIFile).where(func.lower(EDIFile.transaction_type).in_(allowed_types))
        res = await session.execute(q)
        files = res.scalars().all()
        print(f"Number of files fetched by query: {len(files)}")

if __name__ == "__main__":
    asyncio.run(main())
