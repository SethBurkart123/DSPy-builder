This is a Next.js + FastAPI project for building DSPY flows.

## Getting Started

Run the development servers:

Backend (FastAPI):

```bash
cd backend
uv sync
uv run uvicorn backend.main:app --reload --port 8000
```

Frontend (Next.js):

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Open http://localhost:3000. The flows dashboard lives in `app/page.tsx`.

API base URL is configurable with `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`).

API endpoints (base `/api`):

- `GET /api/flows/` list flows
- `POST /api/flows/` create flow { name }
- `PATCH /api/flows/{id}` rename flow { name }
- `DELETE /api/flows/{id}` delete flow
- `GET /api/flows/{id}` get a single flow

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
