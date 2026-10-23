const fetch =require ("node-fetch");

const run = async () => {
  const res = await fetch("http://localhost:5001/add-to-energy-auctions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sellerid: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
      energytype: "Solar",
      walletAddress: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
      walletPrivateKey: "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
      email: "user@email.com",
      units: 150,
      tokens: 5,
      auctionStart: "2025-10-05T10:00:00.000Z",
      auctionEnd: "2025-10-06T10:00:00.000Z"
    }),
  });

  const data = await res.json();
  console.log("Response:", data);
};

run();
