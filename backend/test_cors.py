import httpx
import asyncio

async def main():
    async with httpx.AsyncClient() as client:
        res = await client.options(
            'http://localhost:8000/api/files',
            headers={
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'GET'
            }
        )
        print(dict(res.headers))

if __name__ == "__main__":
    asyncio.run(main())
