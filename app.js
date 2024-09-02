const express = require("express");
const cors = require("cors");
const app = express();
const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const { createMint, getOrCreateAssociatedTokenAccount, mintTo, transfer, getAssociatedTokenAddress } = require("@solana/spl-token");
const { getExplorerLink } = require("@solana-developers/helpers");
const { getKeypairFromEnvironment } = require("@solana-developers/node-helpers");
const bs58 = require("bs58");
const { createCreateMetadataAccountV3Instruction } = require("@metaplex-foundation/mpl-token-metadata")
const dotenv = require("dotenv")
dotenv.config()

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
// 

// const createToken = async(decimal) => {
//     const token = await createMint(
//         connection,
//         OWNER,
//         OWNER.publicKey,
//         null,
//         decimal
//     );
//     console.log(token.toString());
//     const link = getExplorerLink("address", token.toString(), "devnet");
// }
// Function to get the balance of the associated token account
async function getTokenBalance(tokenwallet, mainwallet) {
    try {
      // Get the associated token account address
      const associatedTokenAddress = await getAssociatedTokenAddress(tokenwallet, mainwallet);
  
      // Fetch account info for the associated token account
      const tokenAccountInfo = await getAccount(connection, associatedTokenAddress);
  
      // Retrieve and log the token balance
      const balance = tokenAccountInfo.amount; // Amount is in smallest units (like lamports)
      console.log(`Token Balance: ${balance}`);
      return balance;
    } catch (error) {
      console.error("Error fetching token balance:", error.message);
    }
  }

app.post("/", async (req, res) => {
    const { name, symbol, decimal, supply } = req.body;
    const keypair = process.env.KEYPAIR || null
    if (!keypair) {
        console.log("❌ failed");
    }
    const OWNER = getKeypairFromEnvironment('KEYPAIR')

    // CREATE TOKEN MINT
    const token = await createMint(
        connection,
        OWNER,
        OWNER.publicKey,
        null,
        decimal
    );

    // BRAND THE TOKEN (WITH METADATA)
    const tokenAccount = new PublicKey(token.toString())
    const tokenmetadataid = new PublicKey(process.env.TOKEN_META_ID)
    const metadata = {
        name: name,
        symbol: symbol,
        uri: "https://codemonga.com",
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null,
    }
    const metadatatokensync = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            tokenmetadataid.toBuffer(),
            tokenAccount.toBuffer(),
        ],
        tokenmetadataid
    )

    const metadataPDA = metadatatokensync[0]
    const transaction = new Transaction();
    const addMetadataToTokenInstruction = createCreateMetadataAccountV3Instruction({
        metadata: metadataPDA,
        mint: tokenAccount,
        mintAuthority: OWNER.publicKey,
        payer: OWNER.publicKey,
        updateAuthority: OWNER.publicKey
    }, {
        createMetadataAccountArgsV3: {
            collectionDetails: null,
            data: metadata,
            isMutable: true
        },
    })

    transaction.add(addMetadataToTokenInstruction)
    const signature = await sendAndConfirmTransaction(connection, transaction, [ OWNER ])
    console.log("metadata signature: "+signature);
    const link = getExplorerLink("address", tokenAccount.toString(), "devnet");

    // CREATE ASSOCIATE TOKEN ACCOUNT FOR YOURSELF
    console.log("owner public key: "+OWNER.publicKey.toBase58());
    
    const recipientAccount = new PublicKey(OWNER.publicKey.toBase58())
    const ata = await getOrCreateAssociatedTokenAccount(connection, OWNER, tokenAccount, recipientAccount);

    // MINT TOKENS TO ASSOCIATE ACCOUNT
    const MINOR_UNITS_PER_MAJOR_UNIT = Math.pow(10, decimal)
    const mintSignature = await mintTo(
        connection, 
        OWNER, 
        tokenAccount,
        ata.address,
        OWNER,
        supply*MINOR_UNITS_PER_MAJOR_UNIT
    )
    console.log("✅  mint signature: "+mintSignature);
    
    res.json({ associate_account: ata.address, authority: OWNER.publicKey.toBase58(), token_address: token.toString(), link });
    return;
});

app.post("/transfer", async (req, res) => {
    const { amount, recipient, sender, senderwallet } = req.body;
    const keypair = process.env.KEYPAIR || null
    if (!keypair) {
        console.log("❌ failed");
    }
    const OWNER = getKeypairFromEnvironment('KEYPAIR')
    const MINOR_UNITS_PER_MAJOR_UNIT = Math.pow(10, decimal)

    const balance = await getTokenBalance(sender, senderwallet)

    const signature = await transfer(connection, OWNER, sender, recipient, OWNER, amount*MINOR_UNITS_PER_MAJOR_UNIT)
    
    res.json({ associate_account: ata.address, authority: OWNER.publicKey.toBase58(), token_address: token.toString(), link });
    return;
});

app.listen(4000, () => console.log("server started listening"));
