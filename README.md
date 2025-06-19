Bitespeed Identity Service
A simple NestJS API for contact identity reconciliation using PostgreSQL.
Setup

Prerequisites:

Node.js (v16+)
PostgreSQL (v13+)
npm (v8+)

Install Dependencies:
npm install

Set Up PostgreSQL:Create a database:

```zsh
psql -U postgres -c "CREATE DATABASE bitespeed;"
```

Configure .env:Create .env in the project root:

```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=bitespeed
```

Running
Start the application:
npm run start

API
POST /contact/identify
Identifies or creates a contact.
Request:

```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": "+123456"
}
```

Response:

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu"],
    "phoneNumbers": ["+123456"],
    "secondaryContactIds": []
  }
}
```
