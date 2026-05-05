import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("HelloEcoKnockModule", (m) => {
  const initialMessage =
    m.getParameter("initialMessage", "Hello from eco-knock-blockchain");

  const helloEcoKnock = m.contract("HelloEcoKnock", [initialMessage]);

  return { helloEcoKnock };
});
