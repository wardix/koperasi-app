import app from './server/index';

async function test() {
  const req = new Request('http://localhost/api/v1/accounting/journals', {
    method: 'POST',
    headers: {
      'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxZGQxZGQyOS02NmRiLTQ2NDQtYjZlOS1jYmRkZTQzZGNlOTYiLCJlbWFpbCI6IndhcmRpeEBudXNhLmlkIiwicm9sZSI6InN1cGVyYWRtaW4iLCJleHAiOjE3ODYzNzE5MDgsImp0aSI6IjFkNzAwMDQ0LTk5YmMtNDk0YS1hYjIxLTlmNTUxMWIxMmUxNSJ9.1yE_Lj5wFXf0PUatnGRq8oGhWjQzwXTy8-nk5RLGM2Q',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      "transaction_date": "2026-07-05",
      "description": "Pencairan Pinjaman Modal Usaha Tahap I (PT. Media Antar Nusa)",
      "lines": [
        {
          "account_id": "3fd3deae-73a0-4790-a87b-45cb7b7af1f8",
          "debit": 50000000,
          "credit": 0
        },
        {
          "account_id": "1a96a665-386f-4b3b-8216-f3aed4f4754c",
          "debit": 0,
          "credit": 50000000
        }
      ]
    })
  });

  const res = await app.fetch(req);
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
  
  process.exit(0);
}

test();
