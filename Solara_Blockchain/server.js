const express = require("express");
const cors = require("cors");
const CryptoJS=require("crypto-js");
const { JsonRpcProvider, Wallet, parseUnits, formatEther, isAddress,Contract } = require("ethers");
const { ethers } = require("hardhat");
const noemailer=require("nodemailer");
const { even } = require("prelude-ls");
const { Set } = require("immutable");
const { date } = require("fp-ts");
const Razorpay =require("razorpay");
const { success } = require("io-ts");
const { error, cat } = require("shelljs");
const { cons } = require("fp-ts/lib/NonEmptyArray2v");
const { K } = require("handlebars/runtime");
const { usage } = require("yargs");
const csv=require("csv-parser");
const fs=require("fs");
const requireFromString = require("require-from-string");
const energyType=["Solar","Wind","Hydro"];
require("dotenv").config();
const app = express();
app.use(cors());
app.use(express.json());
let qaData=[];
let imageMatch=[];
let tokenPrice=0.0;
let totalRewards=1000000;
let userRewards=50;
let transactions=[{}];
let userOrders=[{}];
let userEnergyOrders=[{}];
let sellOrders=[{}];
let energyTrader=[{}];
let energyAuctions=[{}];
let userEnergyAuctions=[{}];
let bidders=[{}]
let prices=[];
let priceData = [
  { date:new Date().toLocaleTimeString(), price: Number(tokenPrice)/100*100, volume: 1000 },
];
const energySource=[
  { name: "Solar", value: 45 },
  { name: "Wind", value: 25 },
  { name: "Hydro", value: 15 },
];
fs.createReadStream('chatbot_menus_50.csv')
  .pipe(csv())
  .on('data',(row)=>{
    qaData.push({
      question:row.question.trim().toLowerCase(),
      answer:row.answer,
      tags:row.tags,
      context:row.context
    });
  })
  .on('end',()=>{
    console.log('CSV file successfully load.');
  });

const provider = new JsonRpcProvider(process.env.RPC_URL);
const treasuryWallet = new Wallet(process.env.TREASURY_PRIVATE_KEY, provider);
const deployerAddress=new Wallet(process.env.PRIVATE_KEY, provider);

const tokenAbi = require("./artifacts/contracts/solaratoken.sol/SolaraToken.json").abi;
const priceAbi=require("./artifacts/contracts/pricing.sol/Pricing.json").abi;
const energyAbi=require("./artifacts/contracts/energycontract.sol/EnergyContract.json").abi;

const generateUniqueId = () => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
const tokenDeployerContract = new Contract(
  process.env.TOKEN_CONTRACT_ADDRESS,
  tokenAbi,
  deployerAddress
);
const tokenPriceContract=new ethers.Contract(
  process.env.PRICE_WALLET_ADDRESS,
  priceAbi,
  deployerAddress
);
const energyContract=new ethers.Contract(
  process.env.ENERGY_ADDRESS,
  energyAbi,
  deployerAddress
);
const razorpay=new Razorpay({
  key_id:process.env.RAZOR_KEY_ID,
  key_secret:process.env.RAZOR_KEY_SECRET
});
function getRandomPrice(base) {
  const maxVariation = base * 0.10; 
  const variation = (Math.random() * 2 - 1) * maxVariation; 
  const newPrice = base + variation;
  return newPrice; 
}

async function generateTheprice() {
  tokenPrice=await tokenPriceContract.getPrice();
  const fluctuation=(Number(tokenPrice)/100)*(Math.random()*0.01-0.005);
  tokenPrice=Number((Number(tokenPrice)/100+fluctuation).toFixed(6));
}
async function generateSeller() {
  tokenPrice=await tokenPriceContract.getPrice();
  const tokens=((Math.random()*10)+1).toFixed(0);
  const date=new Date();
  const isTresaurySender=Math.random()>0.5;
  let seller=isTresaurySender?deployerAddress:treasuryWallet;
  let ids=generateUniqueId().toString();
  const order={
    id:ids,
    address:seller.address,
    selltokens:tokens,
    price:Number(tokens*Number(tokenPrice)/100).toFixed(2),
    date:date.toLocaleTimeString(),
  }
  if(sellOrders.length>0 && Object.keys(sellOrders[0]).length===0){
      sellOrders.shift();
    }
  sellOrders.unshift(order);
  if(sellOrders.length>10) sellOrders.pop();
}
async function generateTransaction(){
  const amount=(Math.random()*10).toFixed(0);
  const date=new Date();
  const isTresaurySender=Math.random()>0.5;
  let from,to,fromSigner,contractWithSigner;
  if(isTresaurySender){
    from=deployerAddress;
    to=treasuryWallet;
    fromSigner=deployerAddress;
  }else{
    from=treasuryWallet;
    to=deployerAddress;
    fromSigner=treasuryWallet;
  }
  try{
    contractWithSigner=tokenDeployerContract.connect(fromSigner);
    const tx=await contractWithSigner.transfer(to.address,parseUnits(amount.toString(),18));
    await tx.wait();
    contractWithSigner.on("TokenTransaction",(user,tokens,txType,timestamp,event)=>{
      console.log("User:", user);
      console.log("Tokens:", ethers.formatUnits(tokens, 18));
      console.log("Type:", txType);
      console.log("Timestamp:", timestamp.toString());
      console.log("Event:", event.transactionHash);
    });
    const fromWei=await tokenDeployerContract.balanceOf(from.address);
    const fromBalance=ethers.formatUnits(fromWei,18);

    const toWei=await tokenDeployerContract.balanceOf(to.address);
    const toBalance=ethers.formatUnits(toWei,18);
    let ids=generateUniqueId().toString();
    const transaction={
      id:ids,
      from:from.address,
      to:to.address,
      amount,
      date:date.toLocaleString(),
      fromBalance:fromBalance,
      toBalance:toBalance
    };
     if(transactions.length>0 && Object.keys(transactions[0]).length===0){
      transactions.shift();
    }
    transactions.unshift(transaction);
    if(transactions.length>20) transactions.pop();
  }catch(error){
    console.error("Error",error);
  }
}
function getLast7DaysProduction(){
  const days=[];
  for(let i=6;i>=0;i--){
    const d=new Date();
    d.setDate(d.getDate()-i);
    const label=d.toLocaleDateString("en-US",{
      month:"short",
      day:"2-digit",
    });
    const solar=Math.floor(Math.random()*(80-40)+40);
    const wind=Math.floor(Math.random()*(50-20)+20);
    const hydro=Math.floor(Math.random()*(50-10)+10);
    days.push({date:label,solar,wind,hydro});
  }
  return days;
}
function getLast7Days(){
  const days=[];
  for(let i=6;i>=0;i--){
    const d=new Date();
    d.setDate(d.getDate()-i);
    const label=d.toLocaleDateString("en-US",{
      month:"short",
      day:"2-digit",
    });
    days.push({date:label,usage:Math.floor(Math.random()*(250-100)+100)});
  }
  return days;
}
function formatDate(date){
  const pad=(n)=>(n<10?"0"+n:n);
  const day=pad(date.getDate());
  const month=pad(date.getMonth()+1);
  const year=date.getFullYear();
  const hours=pad(date.getHours());
  const minutes=pad(date.getMinutes());
  const seconds=pad(date.getSeconds());
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}
async function getHoldersCount(contract) {
  try{
    const transferfilter=contract.filters.Transfer();
    const events=await contract.queryFilter(transferfilter,0,"latest");
    const ZERO_ADDRESS = ethers.constants?.AddressZero || ethers.ZeroAddress;
    const holders=new Set();
    for(const event of events ){
      const{from,to}=event.args;
      if(from && from!==ZERO_ADDRESS){
        holders.add(from)
      }
      if(to && to!==ZERO_ADDRESS){
        holders.add(to);
      }
    }
    const holderArray = Array.from(holders);
    const balances = await Promise.all(
      holderArray.map((addr) => contract.balanceOf(addr))
    );
    const validHolders = holderArray.filter((_, i) => balances[i].gt(0));

    console.log("Total Holders:", validHolders.length);
    return validHolders.length;
  }catch(error)
  {
    console.error("Error fetching holders:",error);
    return 0;
  }
}
app.get("/imageanalysis",(req,res)=>{
  const imageData=req.body;
  try{
      
  }catch(error){
    res.status(400).json({success:false,error:error});
  }
});
app.get('/qa',(req,res)=>{
  res.json(qaData);
});
app.get("/userreports",async(req,res)=>{
  try {
  const currentBlock = await provider.getBlockNumber();
  const lockblock = 5000;
  let fromBlock = currentBlock - lockblock;
  if (fromBlock < 0) fromBlock = 0;

  let events = [];
  if (currentBlock > 0) {
    const filter = tokenDeployerContract.filters.TokenTransaction();
    events = await tokenDeployerContract.queryFilter(filter, fromBlock, currentBlock);
  }

  console.log("Fetched events:", events.length);

  const txs = events.map((e, i) => {
    const { user, tokens, txType, timestamp } = e.args;
    return {
      id: i,
      user,
      tokens: ethers.formatUnits(tokens?.toString?.()) || ethers.formatUnits(tokens), // handle BigInt
      type: txType,
      date: new Date(Number(timestamp) * 1000).toLocaleDateString(),
      txHash: e.transactionHash,
    };
  });

  const recentTransactions = txs.reverse().slice(0, 10);

 
  const usageMap = {};
  txs.forEach(tx => {
    if (!usageMap[tx.date]) usageMap[tx.date] = 0;
    usageMap[tx.date] += Number(tx.tokens);
  });
  const tokenUsage = Object.keys(usageMap).map(date => ({
    date,
    tokens: usageMap[date],
  }));

  const userMap = {};
  txs.forEach(tx => {
    if (!userMap[tx.user]) userMap[tx.user] = 0;
    userMap[tx.user] += Number(tx.tokens);
  });
  const userEnergy =[
    {
      name:"Total",
      value:energySource.reduce((sum,item)=>sum+item.value,0),
    }
  ]

  console.log({ recentTransactions, tokenUsage, userEnergy });

  res.json({ recentTransactions, tokenUsage, userEnergy });

} catch (error) {
  console.error("Error in fetching events:", error);
  res.status(200).json({ error: "Failed to fetch the data from blockchain" });
}

});
app.get("/production",(req,res)=>{
  res.json(getLast7DaysProduction());
})
app.get("/energyconsumption",(req,res)=>{
  const energyData=getLast7Days();
  res.json({energyData,energySource});
});
app.get("/priceanalytics",async(req,res)=>{
  try{
  tokenPrice=await tokenPriceContract.getPrice();
  const randomFluctuation = (Math.random() * 2 - 1).toFixed(2);
  const newPrice =Math.max(1,(Number(tokenPrice)/100)+parseFloat(randomFluctuation));
  const newVolume = Math.floor(Math.random() * (3000 - 1000) + 1000);

  priceData = [
    ...priceData.slice(-6), 
    { date: new Date().toLocaleTimeString(), price: parseFloat(newPrice), volume: newVolume },
  ];
  res.json(priceData);
  }catch(error){
    res.json({"error":error});
  }
});
app.post("/updateprice",async(req,res)=>{
  try{
    const {price}=req.body;
    await tokenPriceContract.setUpdatePrice(price)
    tokenPrice=await tokenPriceContract.getPrice();
    console.log(price);
    res.json({success:true});
  }catch(error){
    res.status(200).json({success:false,error:error});
  }
});
app.get("/prices", async (req, res) => {
  try {
    let currentPrice;
    if(Number(tokenPrice)===0){
      tokenPrice = await tokenPriceContract.getPrice();
      currentPrice= Number(tokenPrice) / 100;
    }
    const today = new Date().toISOString().split("T")[0];
    let lastEntry = prices[prices.length - 1];
    if (!lastEntry) {
      prices.push({
        date: today,
        price: parseFloat(currentPrice),
      });
    }
   
    const last = prices[prices.length - 1];
    const lastDate = new Date(last.date);
    const nextDate = new Date(lastDate);
    nextDate.setDate(lastDate.getDate() + 1);
    const nextPrice = getRandomPrice(last.price);
    //console.log(nextPrice.toFixed(2));
    prices.push({
      date: nextDate.toISOString().split("T")[0],
      price:parseFloat(nextPrice.toFixed(2)),
    });

    console.log("Prices:", prices);

    res.json(prices);
  } catch (error) {
    console.error("Error in /prices:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/auctions-energy-list",async(req,res)=>{
  try{
  const type=energyType[Math.floor(Math.random()*energyType.length)];
  const isTresaurySender=Math.random()>0.5;
  let auctionStart = new Date();
  let auctionEnd = new Date(Date.now() + 24 * 60 *60 * 1000);
  let sellerAddress;
  if(isTresaurySender){
    sellerAddress=deployerAddress;
  }else{
    sellerAddress=treasuryWallet;
  }
  //const id=generateUniqueId();
  const units=Math.floor(Math.random() * 500) + 50;
  const tokens=Math.floor(Math.random()*10)+1;
  const tx = await energyContract.addTrade(
      sellerAddress,
      type,
      units,
      tokens,
      "auction",
      Math.floor(new Date(auctionStart).getTime() / 1000),
      Math.floor(new Date(auctionEnd).getTime() / 1000)
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find(log => log.fragment?.name === "TradeCreated");
    const { id } = event.args;
  const auction={
    id:id.toString(),
    sellerid:sellerAddress.address,
    energyType:type,
    seller:sellerAddress.address,
    units:units,
    tokens:tokens,
    auctionStart:auctionStart,
    auctionEnd:auctionEnd,
    type:'auction',
    status:'pending',
    createdAt:new Date().toLocaleString()
  };
   energyAuctions.unshift(auction);
    //if(energyTrader.length>10) energyTrader.pop();
    res.json({success:true, order:auction});
}catch(error){
  res.status(500).json({success:false,error:error.message});
}
});
app.post("/add-to-energy-auctions", async (req, res) => {
  const { sellerid, energytype, walletAddress, walletPrivateKey, email, units, tokens, auctionStart, auctionEnd } = req.body;

  try {
    
    const tx = await energyContract.addTrade(
      walletAddress,
      energytype,
      units,
      tokens,
      "auction",
      Math.floor(new Date(auctionStart).getTime() / 1000),
      Math.floor(new Date(auctionEnd).getTime() / 1000)
    );

    const receipt = await tx.wait();
    const event = receipt.logs.find(log => log.fragment?.name === "TradeCreated");
    const { id } = event.args;

    const auction = {
      id: id.toString(),
      sellerid,
      energyType: energytype,
      seller: walletAddress,
      units,
      tokens,
      auctionStart,
      auctionEnd,
      type: "auction",
      status: "pending",
      createdAt: new Date().toLocaleString()
    };

    energyAuctions.unshift(auction);

    res.json({
      success: true,
      txHash: receipt.transactionHash,
      order: auction
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


app.post("/get-energy-auction",async(req,res)=>{
  const {walletAddress}=req.body;
  if(!isAddress(walletAddress)) 
    return res.status(200).json({success:false,error:"Invalid wallet address"});
  try{
    let seller=[{}];
    const selldetails=energyAuctions.find(
      (order)=>order.seller===walletAddress
    );
    console.log(selldetails);
    if(selldetails){
      seller.push(selldetails);
    }
    if(seller.length>0 && Object.keys(seller[0]).length===0){
      seller.shift();
    }
    //console.log(seller);
    if(seller.length>0){
        seller.forEach((s)=>{
        const exists=userEnergyAuctions.some(order=>order.id===s.id);
        if(!exists){
         userEnergyAuctions.push(s);
      }
    });
    }
    console.log(userEnergyAuctions);
    res.json({success:true,order: userEnergyAuctions})
    //userEnergyOrders=[{}];
  }catch(error){
    res.status(500).json({success:false,error:error.message});
  }
});
app.post("/cancelled-energy-auctions", async (req, res) => {
  const { id } = req.body;
  try {
   
    const tx = await energyContract.connect(treasuryWallet).updateTradeStatus(id, "cancelled");
    await tx.wait();

    // update in-memory list
    const index = energyAuctions.findIndex(order => order.id === id);
    if (index !== -1) {
      energyAuctions.splice(index, 1);
      userEnergyAuctions=[{}];
    }

    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post("/cancelled-energy-trade", async (req, res) => {
  const { id } = req.body;
  try {

    
    const tx = await energyContract.connect(treasuryWallet).updateTradeStatus(id, "cancelled");
    await tx.wait();

    const index = energyTrader.findIndex(order => order.id === id);
    if (index !== -1) energyTrader.splice(index, 1);

    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get("/buy-energy-list",async(req,res)=>{
  try{
  const type=energyType[Math.floor(Math.random()*energyType.length)];
  const isTresaurySender=Math.random()>0.5;
  let sellerAddress;
  if(isTresaurySender){
    sellerAddress=deployerAddress;
  }else{
    sellerAddress=treasuryWallet;
  }
  const units= Math.floor(Math.random() * 500) + 50;
  const tokens= Math.floor(Math.random()*10)+1;
  const tx = await energyContract.addTrade(
      sellerAddress,
      type,
      units,
      tokens,
      "sell",
      0,
      0
    );

    const receipt = await tx.wait();
    const event = receipt.logs.find(log => log.fragment?.name === "TradeCreated");
    const { id } = event.args;
    //console.log(id);
  const trade={
    id:Number(id),
    sellerid:sellerAddress.address,
    energyType:type,
    seller:sellerAddress.address,
    units:units,
    tokens:tokens,
    type:'sell',
    status:'pending',
    createdAt:new Date().toLocaleString()
  };
   energyTrader.unshift(trade);
    res.json({success:true, order:trade});
}catch(error){
  res.status(500).json({success:false,error:error.message});
}
});
app.post("/add-to-energy-seller", async (req, res) => {
  const { sellerid, energytype, walletAddress, units, tokens } = req.body;
  try {
  
      const tx = await energyContract.addTrade(
      walletAddress,
      energytype,
      units,
      tokens,
      "sell",
      0,
      0
    );

    const receipt = await tx.wait();
    const event = receipt.logs.find(log => log.fragment?.name === "TradeCreated");
    const { id } = event.args;

    const trade = {
      id: id.toString(),
      sellerid,
      energyType: energytype,
      seller: walletAddress,
      units,
      tokens,
      type: "sell",
      status: "pending",
      createdAt: new Date().toLocaleString()
    };

    energyTrader.unshift(trade);

    res.json({
      success: true,
      txHash: receipt.transactionHash,
      order: trade
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/get-energy-sell",async(req,res)=>{
  const {walletAddress}=req.body;
  if(!isAddress(walletAddress)) 
    return res.status(200).json({success:false,error:"Invalid wallet address"});
  try{
    let seller=[{}];
    const selldetails=energyTrader.find(
      (order)=>order.seller===walletAddress
    );
    console.log(selldetails);
    if(selldetails){
      seller.push(selldetails);
    }
    if(seller.length>0 && Object.keys(seller[0]).length===0){
      seller.shift();
    }
    //console.log(seller);
    if(seller.length>0){
        seller.forEach((s)=>{
        const exists=userEnergyOrders.some(order=>order.id===s.id);
        if(!exists){
         userEnergyOrders.push(s);
      }
    });
    }
    console.log(userEnergyOrders);
    res.json({success:true,order: userEnergyOrders})
    //userEnergyOrders=[{}];
  }catch(error){
    res.status(500).json({success:false,error:error.message});
  }
});


app.post("/transfer-tokens", async(req,res)=>{
  try{
    const {senderAddress,senderPrivateKey,email,receiverAddress,tokens}=req.body;
    console.log(senderPrivateKey);
    const decrypted = CryptoJS.AES.decrypt(senderPrivateKey, email);
    const privateKeyHex = decrypted.toString(CryptoJS.enc.Utf8);
    console.log(privateKeyHex);
    if(!privateKeyHex || !privateKeyHex.startsWith("0x"))
        throw new Error("Decryption failed:Invalid private key");
    
    const senderWallet=new Wallet(privateKeyHex,provider);
    console.log(senderWallet);
    const token=new Contract(
      process.env.TOKEN_CONTRACT_ADDRESS,
      tokenAbi,senderWallet
    );

    console.log(`Processing transfer from ${senderAddress} for ${tokens} tokens @ ${receiverAddress}`);
    console.log(token);
    let balanceSender=await provider.getBalance(senderAddress);
    let balanceReciver=await provider.getBalance(receiverAddress);
    console.log(balanceSender);
    if(Number(balanceSender)===0){
      const amountToSend=ethers.parseEther("0.001");
      const txETH=await treasuryWallet.sendTransaction({
      to:senderWallet.address,
      value:amountToSend
      });
      tokenDeployerContract.on("TokenTransaction",(user,tokens,txType,timestamp,event)=>{
      console.log("User:", user);
      console.log("Tokens:", ethers.formatUnits(tokens, 18));
      console.log("Type:", txType);
      console.log("Timestamp:", timestamp.toString());
      console.log("Event:", event.transactionHash);
    });
       console.log(txETH);
    }
    const qtyWei= parseUnits(tokens.toString(),18);
    console.log(balanceSender.toString());
    console.log(balanceReciver.toString());
    console.log(qtyWei);
    const tx=await token.transfer(receiverAddress,qtyWei);
    token.on("TokenTransaction",(user,tokens,txType,timestamp,event)=>{
      console.log("User:", user);
      console.log("Tokens:", ethers.formatUnits(tokens, 18));
      console.log("Type:", txType);
      console.log("Timestamp:", timestamp.toString());
      console.log("Event:", event.transactionHash);
    });
    const receipt=await tx.wait();
    balanceSender = await tokenDeployerContract.balanceOf(senderAddress);
    balanceReciver = await tokenDeployerContract.balanceOf(receiverAddress);
    const id=generateUniqueId();
    res.json({
      success:true,
      id:id,
      txHash:receipt.hash,
      block:receipt.blockNumber,
      senderBalance:ethers.formatUnits(balanceSender,18),
      receiverBalance:ethers.formatUnits(balanceReciver,18)
    });

  }catch(error){
    console.error("Error in /transefer:",error);
    res.status(500).json({ success:false, error:error.message});
  }
});

app.post("/buy-energy", async (req, res) => {
  try {
    const { buyer, buyerPrivateKey, email, sellerAddress, id, tokens } = req.body;

    const decrypted = CryptoJS.AES.decrypt(buyerPrivateKey, email);
    const privateKeyHex = decrypted.toString(CryptoJS.enc.Utf8);
    if (!privateKeyHex || !privateKeyHex.startsWith("0x")) {
      throw new Error("Decryption failed: Invalid private key");
    }

    const adminWallet = new Wallet(process.env.PRIVATE_KEY, provider);
    const buyerWallet = new Wallet(privateKeyHex, provider);

    const token = new Contract(process.env.TOKEN_CONTRACT_ADDRESS, tokenAbi, provider);
    const qtyWei = parseUnits(tokens.toString(), 18);

    const buyerEthBalance = await provider.getBalance(buyer);
    const minGas = parseUnits("0.01", "ether"); // send 0.01 ETH if low

    if (buyerEthBalance < minGas) {
      // Send ETH to buyer for gas
      const txFund = await adminWallet.sendTransaction({
        to: buyer,
        value: minGas,
      });
      await txFund.wait();
      console.log(`Funded buyer with 0.01 ETH: ${txFund.hash}`);
    }


    const tokenWithBuyer = token.connect(buyerWallet);
    const approveTx = await tokenWithBuyer.approve(adminWallet.address, qtyWei);
    await approveTx.wait();
    console.log(`Buyer approved ${tokens} tokens for admin`);

    const tokenWithAdmin = token.connect(adminWallet);
    const nonce = await provider.getTransactionCount(adminWallet.address,"latest");
    const transferTx = await tokenWithAdmin.transferFrom(buyer, sellerAddress, qtyWei,{nonce});
    const receipt = await transferTx.wait();


    console.log(`call before energy update${id}`);
    await energyContract.connect(adminWallet).updateTradeStatus(id, "completed");

    const index = energyTrader.findIndex(order => order.id === id);
    if (index !== -1) energyTrader.splice(index, 1);
    const buyerBal = await tokenDeployerContract.balanceOf(buyer);
    const sellerBal = await tokenDeployerContract.balanceOf(sellerAddress);
    res.json({
      success: true,
      txHash: receipt.hash,
      block: receipt.blockNumber,
      buyerBalance:Number(buyerBal),
      sellerBalance:Number(sellerBal)
    });

  } catch (error) {
    console.error("Error in /buy-energy:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});


app.post("/add-to-seller",async(req,res)=>{
  try{
    const {walletAddress,tokens,tokenPrice}=req.body; 
    if(!isAddress(walletAddress)){
      return res.status(200).json({error:"Invalid wallet address"});
    }
    let ids=generateUniqueId().toString();
    const date=new Date();
    const order={
    id:ids,
    address:walletAddress,
    selltokens:tokens,
    price:Number(tokenPrice).toFixed(2),
    type:'sell',
    status:'pending',
    date:date.toLocaleTimeString(),
    }
    sellOrders.unshift(order);
    if(sellOrders.length>10) sellOrders.pop();
    res.json({success:true, order:order});
  }catch(error){
    console.error("Error to add:",error);
    res.status(500).json({success:false,error:error.message});
  }
});
app.post("/get-orders-user",async(req,res)=>{
  try{
    
    const { walletAddress}=req.body;
    let seller=[{}];
    const selldetails=sellOrders.find(
      (order)=>order.address===walletAddress
    );
    console.log(selldetails);
    if(selldetails){
      seller.push(selldetails);
    }
    if(seller.length>0 && Object.keys(seller[0]).length===0){
      seller.shift();
    }
    console.log(seller);
    if(seller.length>0){
        seller.forEach((s)=>{
        const exists=userOrders.some(order=>order.id===s.id);
        console.log('call in seller');
        if(!exists){
        userOrders.push(s);
      }
    });
  }  
   if(userOrders.length>0 && Object.keys(userOrders[0]).length===0){
      userOrders.shift();
    }
    console.log(userOrders);
    res.json({
      success:true,
      orders:userOrders
    });
  }catch(error){
    console.error("Error \n complete in order",error);
    res.status(500).json({success:false,error:error.message});
  }
})
app.post("/delete-to-seller",async(req,res)=>{
  try{
    const {ids}=req.body;
    const indexSeller = sellOrders.findIndex(order => order.id === ids);
    const orderSeller = userOrders.findIndex(order => order.id === ids);
    console.log(indexSeller,);
    if (indexSeller !== -1 && orderSeller!==-1) {
      //console.log(sellOrders.splice(index));
      sellOrders.splice(indexSeller, 1);
      userOrders.splice(orderSeller,1);
      res.json({success:true});
    }else{
      res.json({success:false,error:"Not found"});
    }
  }catch(error){
    res.status(500).json({success:false,error:error.message});
  }
});
app.post("/get-wallet-balance", async(req,res)=>{
  try{
    const { walletAddress }=req.body;
    console.log(`Wallet address ${ walletAddress }`);
    if(!isAddress(walletAddress)){
      return res.status(200).json({error:"Invalid Wallet Address"});
    }
  
    const totalTokens=await tokenDeployerContract.balanceOf(walletAddress);
    console.log(totalTokens);
    res.json({totaltokens:ethers.formatUnits(totalTokens,18)})
  }catch(error){
    res.status(500).json({error:"Can not fetch wallet"});
  }
});

app.post("/buy", async(req,res)=>{
  try{
    const {buyer,sellerAddress,id,qty,price}=req.body;
    console.log(`Processing buy from ${buyer} for ${qty} tokens @ ${price} @ ${sellerAddress}`);
    const qtyWei=parseUnits(qty.toString(),18)
    const sellerSigner = await provider.getSigner(sellerAddress);
    const deployerSigner = await provider.getSigner(deployerAddress.address);
    let sellerBal = await tokenDeployerContract.balanceOf(sellerAddress);
    let buyerBal = await tokenDeployerContract.balanceOf(buyer);
    console.log(qtyWei,buyer);
    console.log(ethers.formatUnits(sellerBal,18),ethers.formatUnits(buyerBal,18));
    let contractWithSigner=await tokenDeployerContract.connect(sellerSigner).approve(
      await deployerSigner.getAddress(),
      qtyWei
    );
    await contractWithSigner.wait();
    const tx=await tokenDeployerContract.connect(deployerSigner).transferFrom(
      sellerAddress,
      buyer,
      qtyWei);
    const receipt=await tx.wait();
    tokenDeployerContract.on("TokenTransaction",(user,tokens,txType,timestamp,event)=>{
      console.log("User:", user);
      console.log("Tokens:", ethers.formatUnits(tokens, 18));
      console.log("Type:", txType);
      console.log("Timestamp:", timestamp.toString());
      console.log("Event:", event.transactionHash);
    });
    sellerBal = await tokenDeployerContract.balanceOf(sellerAddress);
    buyerBal = await tokenDeployerContract.balanceOf(buyer);
    res.json({
      success:true,
      txHash:receipt.hash,
      block:receipt.blockNumber,
      sellerBalance:ethers.formatUnits(sellerBal,18),
      buyerBalance:ethers.formatUnits(buyerBal,18)
    });
    const index = sellOrders.findIndex(order => order.id === id);
    if (index !== -1) {
      sellOrders.splice(index, 1);
    }
  }catch(error){
    console.error("Error in /buy:",error);
    res.status(500).json({ success:false, error:error.message});
  }
});
app.post("/add-fund",async(req,res)=>{
  try{
    const options={
      amount:req.body.amount*100,
      currency:"INR",
      receipt:"receipt_order_"+Date.now(),
    };
    const order=await razorpay.orders.create(options);
    res.json(order);
  }catch(error){
      res.status(200).send(error);
  }
});
app.get("/seller-tokens",async(req,res)=>{
  try{
    generateSeller();
    //console.log(sellOrders);
    if(sellOrders.length>0 && Object.keys(sellOrders[0]).length===0){
      sellOrders.shift();
    }
    res.json({sellOrders:sellOrders});
  }catch(error){
    console.error("Error to fetch",error);
    res.status(200).json({error:"Error to fetch the data"});
  }
});
// Endpoint: Send tokens
app.post("/send-tokens", async (req, res) => {
  try {
    const { recipient } = req.body;
    console.log(recipient)
    if (!isAddress(recipient)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }
    // Send tokens
    let contractWithSigner=tokenDeployerContract.connect(treasuryWallet);
    const tx = await contractWithSigner.transfer(recipient, parseUnits("10", 18));
    await tx.wait();
    contractWithSigner.on("TokenTransaction",(user,tokens,txType,timestamp,event)=>{
    console.log("User:", user);
    console.log("Tokens:", ethers.formatUnits(tokens, 18));
    console.log("Type:", txType);
    console.log("Timestamp:", timestamp.toString());
    console.log("Event:", event.transactionHash);
  });
    const amountToSend=ethers.parseEther("0.01");
    const txETH=await treasuryWallet.sendETH({
      to:recipient,
      value:amountToSend
    });
    console.log(txETH);
    tokenDeployerContract.on("TokenTransaction",(user,tokens,txType,timestamp,event)=>{
    console.log("User:", user);
    console.log("Tokens:", ethers.formatUnits(tokens, 18));
    console.log("Type:", txType);
    console.log("Timestamp:", timestamp.toString());
  });
    /*const senderBalanceAfter = await tokenContract.balanceOf(wallet.address);
    const recipientBalance = await tokenContract.balanceOf(recipient);
    console.log("Sender balance after:", formatEther(senderBalanceAfter));
    console.log("Recipient balance after:", formatEther(recipientBalance));*/
    // Log deployer balance after
    res.status(200).json({ success: true, txHash: tx.hash });

  } catch (error) {
    console.error("Token transfer failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get("/get-token-price",async(req,res)=>{
  try{
  generateTheprice();
  res.json({ price:tokenPrice });
  }catch(error){
    console.error("Error to get data:",error);
    res.status(500).json({error:"Error to  fetch the price"});
  }
});
// Endpoint: Get user balance
app.post("/get-balance", async (req, res) => {
  const { walletAddress } = req.body;
  console.log(walletAddress);
  if (!isAddress(walletAddress)) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }
  try {
    const balance = await tokenDeployerContract.balanceOf(walletAddress);
    res.json({ balance: formatEther(balance) });
  } catch (error) {
    console.error("Error fetching balance:", error);
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

// Endpoint: Get owner balance
app.get("/owner-balance", async (req, res) => {
  try {
    console.log(treasuryWallet.address);
    const ownerAddress = treasuryWallet.address;
    const balance = await tokenDeployerContract.balanceOf(ownerAddress);
    res.json({ owner: ownerAddress, balance: formatEther(balance) });
  } catch (error) {
    console.error("Error fetching owner balance:", error);
    res.status(500).json({ error: "Failed to fetch owner balance" });
  }
});
app.get("/token-stats",async(req,res)=>{
  try{
    const totalSupplyWei=await tokenDeployerContract.totalSupply();
    const totalSupply=ethers.formatUnits(totalSupplyWei,18);

    const treasurerBalanceWei=await tokenDeployerContract.balanceOf(treasuryWallet.address);
    const treasurerBalance=ethers.formatUnits(treasurerBalanceWei,18);
    const circulatingSupply=(parseFloat(totalSupply)-parseFloat(treasurerBalance)).toString()
    console.log(totalSupply,treasurerBalance);
    console.log(deployerAddress);
    console.log(treasuryWallet.address);    
    res.json({
      totalSupply:totalSupply,
      circulatingSupply:circulatingSupply,
    });

  }catch(error){
    console.error(error);
    res.status(500).json({error:'Failed to fetch token stats'});
  }
});
app.get("/tokens-stats",async(req,res)=>{
  try{
    const totalSupplyWei=await tokenDeployerContract.totalSupply();
    const totalSupply=ethers.formatUnits(totalSupplyWei,18);

    const reservedWei=await tokenDeployerContract.balanceOf(treasuryWallet.address);
    const reservedTokens=ethers.formatUnits(reservedWei,18);
    const circulatingSupply=(parseFloat(totalSupply)-parseFloat(reservedTokens)).toString() 
    tokenPrice=await tokenPriceContract.getPrice();
    const marketCap=circulatingSupply*(Number(tokenPrice)/100);
    const holdersCount=await getHoldersCount(tokenDeployerContract);
    const formattedDate=formatDate(new Date());
    res.json({
      totalSupply:totalSupply,
      reservedTokens:reservedTokens,
      circulatingSupply:circulatingSupply.toString(),
      tokenPrice:Number(tokenPrice)/100,
      marketCap:marketCap.toFixed(2),
      holders:holdersCount,
      lastUpdated:formattedDate
    });

  }catch(error){
    console.error(error);
    res.status(500).json({error:'Failed to fetch token stats'});
  }
});
//setInterval(,10000);
app.get("/rewards",async(req,res)=>{
  console.log(res.json);
  generateTransaction();
  res.json({
    tokenPrice: Number(tokenPrice)/100,
    energyConsumption: (Math.random() * 500).toFixed(2),
    energyProduction: (Math.random() * 500).toFixed(2),
    transactions
  });
});
app.use("/auth", require("./imagekit"));
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

/*
 console.log("walletAddress:", walletAddress);
  //console.log("User address:",walletAddress);
   console.log("Raw request body:", req.body);
   const senderBalanceAfter = await tokenContract.balanceOf(wallet.address);
    const recipientBalance = await tokenContract.balanceOf(recipient);
    console.log("Sender balance after:", formatEther(senderBalanceAfter));
    console.log("Recipient balance after:", formatEther(recipientBalance));
     console.log("User address:",walletAddress)
     console.log("Owener address",ownerAddress);*/
