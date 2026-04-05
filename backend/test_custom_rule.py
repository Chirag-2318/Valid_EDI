import asyncio
from app.database import AsyncSessionLocal
from app.db_models import CustomValidationRule

async def main():
    async with AsyncSessionLocal() as session:
        rule = CustomValidationRule(
            name="Test NPI Length",
            segment="NM1",
            condition_type="element_length",
            element_position=9,
            expected_value="10",
            severity="error"
        )
        session.add(rule)
        await session.commit()
        print("Inserted test rule")

asyncio.run(main())
