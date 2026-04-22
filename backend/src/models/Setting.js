const mongoose = require("mongoose");

// Single-document settings collection.
// We enforce single row via a unique singleton flag.
const settingSchema = new mongoose.Schema(
  {
    singleton: { type: Boolean, default: true, unique: true },

    // Brand / basic
    siteName: { type: String, default: "S.Gamage Constructions" },
    tagline: { type: String, default: "Professional building constructions & engineering solutions." },

    // Contact
    email: { type: String, default: "constructionssgamage@gmail.com" },
    phone: { type: String, default: "071 858 4073" },
    address: { type: String, default: "Sri Lanka" },

    // Social
    facebook: { type: String, default: "" },
    instagram: { type: String, default: "" },
    whatsapp: { type: String, default: "94718584073" },

    // Homepage hero
    heroTitle: { type: String, default: "Build with confidence." },
    heroSubtitle: {
      type: String,
      default: "Residential • Commercial • Renovations • Engineering"
    },

    // Checkout / advance payment flow
    orderAdvancePercent: { type: Number, default: 25, min: 0, max: 100 },
    advanceTermsText: {
      type: String,
      default: "An advance payment is required before we reserve stock, schedule delivery, or release special-order materials. The advance is credited against the final order value."
    },
    balanceTermsText: {
      type: String,
      default: "The balance must be settled before dispatch, on delivery, or at collection unless your team has an approved credit arrangement."
    },
    cancellationTermsText: {
      type: String,
      default: "Special-order, cut-to-size, mixed, tinted and custom-procured items may not be cancellable once purchasing has started. Standard-stock items are reviewed case-by-case."
    },
    whatsappCheckoutNote: {
      type: String,
      default: "Please send this order confirmation in WhatsApp after checkout so our team can verify the payment slip quickly."
    },

    // Own-vehicle delivery policy
    deliveryServiceLabel: { type: String, default: "Owner vehicle delivery" },
    deliveryLeadTimeText: {
      type: String,
      default: "After the advance is verified, our team usually confirms stock and schedules delivery within 1 to 3 working days depending on quantity, route and vehicle availability."
    },
    deliveryCoverageText: {
      type: String,
      default: "Hardware orders are delivered by the owner’s own vehicle and delivery boy within serviceable areas, with scheduled routes for bulky loads and construction-site drops."
    },
    deliveryWindowText: {
      type: String,
      default: "Customers receive a planned date / time window, and the delivery boy can call before arrival when requested at checkout."
    },
    deliveryAccessTermsText: {
      type: String,
      default: "Please share accurate access details, road restrictions, unloading support and site contact information. Additional trips or rescheduling may be required if the site is closed or the vehicle cannot enter safely."
    },
    deliveryInspectionText: {
      type: String,
      default: "Please inspect quantities and visible damage at handover, confirm the items match your order, and note any issue immediately before accepting the delivery."
    },

    // Bank / manual methods
    bankTransferEnabled: { type: Boolean, default: true },
    cashDepositEnabled: { type: Boolean, default: true },
    mobileBankingEnabled: { type: Boolean, default: true },
    bankName: { type: String, default: "" },
    bankAccountName: { type: String, default: "" },
    bankAccountNumber: { type: String, default: "" },
    bankBranch: { type: String, default: "" },
    bankInstructions: {
      type: String,
      default: "Use your order total summary on checkout, pay the required advance, then upload the bank slip before placing the order."
    },
    cashDepositInstructions: {
      type: String,
      default: "Deposit the required advance to the account below and upload the deposit slip before placing the order."
    },
    mobileBankingName: { type: String, default: "" },
    mobileBankingNumber: { type: String, default: "" },
    mobileBankingInstructions: {
      type: String,
      default: "Pay the required advance using your banking app or mobile wallet, then upload a screenshot of the successful transfer."
    },

    // Skrill
    skrillEnabled: { type: Boolean, default: false },
    skrillEmail: { type: String, default: "" },
    skrillInstructions: {
      type: String,
      default: "Send the required advance to the Skrill account below and upload the payment screenshot / reference."
    },

    // Crypto
    cryptoEnabled: { type: Boolean, default: false },
    cryptoCurrency: { type: String, default: "USDT" },
    cryptoNetwork: { type: String, default: "TRC20" },
    cryptoWalletAddress: { type: String, default: "" },
    cryptoQrImageUrl: { type: String, default: "" },
    cryptoInstructions: {
      type: String,
      default: "Send only the required advance amount to the wallet and network shown below. Upload the transfer proof and include the transaction hash."
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema);
