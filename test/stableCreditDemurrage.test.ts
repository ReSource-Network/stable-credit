import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import chai from "chai"
import { solidity } from "ethereum-waffle"
import { formatStableCredits, parseStableCredits } from "../utils/utils"
import { formatEther, parseEther } from "ethers/lib/utils"
import { NetworkContracts, stableCreditFactory } from "./stableCreditFactory"
import { StableCreditDemurrage } from "../types/StableCreditDemurrage"

chai.use(solidity)

describe("Stable Credit Demurrage Tests", function () {
  let contracts: NetworkContracts
  let stableCredit: StableCreditDemurrage
  let memberA: SignerWithAddress
  let memberB: SignerWithAddress
  let memberC: SignerWithAddress
  let memberD: SignerWithAddress
  let memberE: SignerWithAddress
  let memberF: SignerWithAddress

  this.beforeEach(async function () {
    const accounts = await ethers.getSigners()
    memberA = accounts[1]
    memberB = accounts[2]
    memberC = accounts[3]
    memberD = accounts[4]
    memberE = accounts[5]
    memberF = accounts[6]

    contracts = await stableCreditFactory.deployDemurrageWithSupply()
    stableCredit = contracts.stableCredit as StableCreditDemurrage
    await ethers.provider.send("evm_increaseTime", [10])
    await ethers.provider.send("evm_mine", [])
  })

  it("demurrage burn updates total supply", async function () {
    // check total supply before default
    expect(formatStableCredits(await stableCredit.totalSupply())).to.equal("30.0")
    // default memberA
    await ethers.provider.send("evm_increaseTime", [100])
    await ethers.provider.send("evm_mine", [])
    await expect(contracts.riskManager.validateCreditLine(stableCredit.address, memberA.address)).to
      .not.be.reverted
    expect(formatStableCredits(await stableCredit.networkDebt())).to.equal("10.0")
    // demurrage network
    await expect(stableCredit.demurrageMembers(parseStableCredits("10"))).to.not.be.reverted
    // check total supply after default
    expect(formatStableCredits(await stableCredit.totalSupply())).to.equal("30.0")
    // burn memberB demuraged tokens
    await expect(stableCredit.burnDemurraged(memberB.address)).to.not.be.reverted
    // check total supply after token burn
    expect(formatStableCredits(await stableCredit.totalSupply())).to.equal("26.666666")
    // burn memberD demuraged tokens
    await expect(stableCredit.burnDemurraged(memberD.address)).to.not.be.reverted
    // check total supply after final burn (total supply should now be accurate because all demurraged tokens are burned away)
    expect(formatStableCredits(await stableCredit.totalSupply())).to.equal("23.333332")
    // check positive balances
    expect(formatStableCredits(await stableCredit.balanceOf(memberB.address))).to.equal("6.666666")
    expect(formatStableCredits(await stableCredit.balanceOf(memberD.address))).to.equal("6.666666")
  })

  it("demurrage updates balances proportionally", async function () {
    // default memberA
    await ethers.provider.send("evm_increaseTime", [100])
    await ethers.provider.send("evm_mine", [])
    await expect(contracts.riskManager.validateCreditLine(stableCredit.address, memberA.address)).to
      .not.be.reverted
    // demurrage network
    await expect(stableCredit.demurrageMembers(parseStableCredits("10"))).to.not.be.reverted

    // check memberA credit balance (default should liquidate credit line)
    expect(formatStableCredits(await stableCredit.creditBalanceOf(memberA.address))).to.equal("0.0")

    // check memberB balance (demuraged to cover default)
    expect(formatStableCredits(await stableCredit.balanceOf(memberB.address))).to.equal("6.666666")
    // check memberD balance (demuraged to cover default)
    expect(formatStableCredits(await stableCredit.balanceOf(memberD.address))).to.equal("6.666666")
  })

  it("credits minted after demurrage do not affect positive balances", async function () {
    // default memberA
    await ethers.provider.send("evm_increaseTime", [100])
    await ethers.provider.send("evm_mine", [])
    await expect(contracts.riskManager.validateCreditLine(stableCredit.address, memberA.address)).to
      .not.be.reverted
    // demurrage network
    await expect(stableCredit.demurrageMembers(parseStableCredits("10"))).to.not.be.reverted

    // check positive balances before minted
    expect(formatStableCredits(await stableCredit.balanceOf(memberB.address))).to.equal("6.666666")
    expect(formatStableCredits(await stableCredit.balanceOf(memberD.address))).to.equal("6.666666")
    expect(formatStableCredits(await stableCredit.balanceOf(memberF.address))).to.equal("6.666666")

    // mint 10 new tokens
    await (
      await contracts.stableCredit
        .connect(memberE)
        .transfer(memberD.address, ethers.utils.parseUnits("10", "mwei"))
    ).wait()

    // check balances
    expect(formatStableCredits(await stableCredit.balanceOf(memberB.address))).to.equal("6.666666")
    expect(formatStableCredits(await stableCredit.balanceOf(memberD.address))).to.equal("16.666666")
    expect(formatStableCredits(await stableCredit.balanceOf(memberF.address))).to.equal("6.666666")
  })

  it("balances are unaltered after burning of demurraged credits", async function () {
    // default memberA
    await ethers.provider.send("evm_increaseTime", [100])
    await ethers.provider.send("evm_mine", [])
    await expect(contracts.riskManager.validateCreditLine(stableCredit.address, memberA.address)).to
      .not.be.reverted
    // demurrage network
    await expect(stableCredit.demurrageMembers(parseStableCredits("10"))).to.not.be.reverted
    // check positive balances (should be demurraged)
    expect(formatStableCredits(await stableCredit.balanceOf(memberB.address))).to.equal("6.666666")
    expect(formatStableCredits(await stableCredit.balanceOf(memberD.address))).to.equal("6.666666")
    expect(formatStableCredits(await stableCredit.balanceOf(memberF.address))).to.equal("6.666666")

    await expect(stableCredit.burnDemurraged(memberB.address)).to.not.be.reverted

    // check positive balances (should be demurraged)
    expect(formatStableCredits(await stableCredit.balanceOf(memberB.address))).to.equal("6.666666")
    expect(formatStableCredits(await stableCredit.balanceOf(memberD.address))).to.equal("6.666666")
    expect(formatStableCredits(await stableCredit.balanceOf(memberF.address))).to.equal("6.666666")
  })

  it("credits transfered after network wide demurrage are unaffected", async function () {
    // default memberA
    await ethers.provider.send("evm_increaseTime", [100])
    await ethers.provider.send("evm_mine", [])
    await expect(contracts.riskManager.validateCreditLine(stableCredit.address, memberA.address)).to
      .not.be.reverted
    // demurrage network
    await expect(stableCredit.demurrageMembers(parseStableCredits("10"))).to.not.be.reverted
    // check positive balances
    expect(formatStableCredits(await stableCredit.balanceOf(memberB.address))).to.equal("6.666666")
    expect(formatStableCredits(await stableCredit.balanceOf(memberD.address))).to.equal("6.666666")
    expect(formatStableCredits(await stableCredit.balanceOf(memberF.address))).to.equal("6.666666")

    // transfer 5 tokens from D to B
    await (
      await contracts.stableCredit
        .connect(memberD)
        .transfer(memberB.address, ethers.utils.parseUnits("6.666666", "mwei"))
    ).wait()

    // check positive balances
    expect(formatStableCredits(await stableCredit.balanceOf(memberB.address))).to.equal("13.333332")
    expect(formatStableCredits(await stableCredit.demurragedBalanceOf(memberB.address))).to.equal(
      "0.0"
    )
    expect(formatStableCredits(await stableCredit.balanceOf(memberD.address))).to.equal("0.0")
    expect(formatStableCredits(await stableCredit.demurragedBalanceOf(memberB.address))).to.equal(
      "0.0"
    )
    expect(formatStableCredits(await stableCredit.balanceOf(memberF.address))).to.equal("6.666666")
  })

  it("max transfer of burned demurrage balance does not effect other balances", async function () {
    // default memberA
    await ethers.provider.send("evm_increaseTime", [100])
    await ethers.provider.send("evm_mine", [])
    await expect(contracts.riskManager.validateCreditLine(stableCredit.address, memberA.address)).to
      .not.be.reverted
    // demurrage network
    await expect(stableCredit.demurrageMembers(parseStableCredits("10"))).to.not.be.reverted

    expect(formatStableCredits(await stableCredit.balanceOf(memberB.address))).to.equal("6.666666")

    await expect(stableCredit.burnDemurraged(memberB.address)).to.not.be.reverted

    expect(formatStableCredits(await stableCredit.balanceOf(memberB.address))).to.equal("6.666666")

    await expect(
      contracts.stableCredit
        .connect(memberB)
        .transfer(memberE.address, parseStableCredits("6.666666"))
    ).to.not.be.reverted

    expect(formatStableCredits(await stableCredit.balanceOf(memberB.address))).to.equal("0.0")

    expect(formatStableCredits(await stableCredit.balanceOf(memberD.address))).to.equal("6.666666")
  })

  it("multiple demurrages updates coversion rate accordingly", async function () {
    // default memberA
    await ethers.provider.send("evm_increaseTime", [100])
    await ethers.provider.send("evm_mine", [])
    await expect(contracts.riskManager.validateCreditLine(stableCredit.address, memberA.address)).to
      .not.be.reverted
    // demurrage network
    await expect(stableCredit.demurrageMembers(parseStableCredits("10"))).to.not.be.reverted

    // all existing debt is in default
    expect(formatEther(await stableCredit.conversionRate())).to.equal("0.666666666666666667")

    // default memberC
    await ethers.provider.send("evm_increaseTime", [100])
    await ethers.provider.send("evm_mine", [])
    await expect(contracts.riskManager.validateCreditLine(stableCredit.address, memberC.address)).to
      .not.be.reverted
    // demurrage network
    await expect(stableCredit.demurrageMembers(parseStableCredits("10"))).to.not.be.reverted
    expect(formatEther(await stableCredit.conversionRate())).to.equal("0.333333333333333334")

    // default memberE
    await ethers.provider.send("evm_increaseTime", [100])
    await ethers.provider.send("evm_mine", [])
    await expect(contracts.riskManager.validateCreditLine(stableCredit.address, memberE.address)).to
      .not.be.reverted
    // demurrage network
    await expect(stableCredit.demurrageMembers(parseStableCredits("10"))).to.not.be.reverted
    expect(formatEther(await stableCredit.conversionRate())).to.equal("0.0")
  })

  it("deumurrage results in members demurrage balance to update proportionally", async function () {
    // default memberA
    await ethers.provider.send("evm_increaseTime", [100])
    await ethers.provider.send("evm_mine", [])
    await expect(contracts.riskManager.validateCreditLine(stableCredit.address, memberA.address)).to
      .not.be.reverted
    // demurrage network
    await expect(stableCredit.demurrageMembers(parseStableCredits("10"))).to.not.be.reverted

    expect(formatStableCredits(await stableCredit.demurragedBalanceOf(memberB.address))).to.equal(
      "3.333334"
    )
  })

  it("network demurrage with insuffienct network debt is reverted", async function () {
    await expect(stableCredit.demurrageMembers(parseStableCredits("10"))).to.be.reverted
  })

  it("network demurrage updates network debt", async function () {
    // check total supply before default
    expect(formatStableCredits(await stableCredit.totalSupply())).to.equal("30.0")
    // default memberA
    await ethers.provider.send("evm_increaseTime", [100])
    await ethers.provider.send("evm_mine", [])
    await expect(contracts.riskManager.validateCreditLine(stableCredit.address, memberA.address)).to
      .not.be.reverted
    expect(formatStableCredits(await stableCredit.networkDebt())).to.equal("10.0")
    // demurrage network
    await expect(stableCredit.demurrageMembers(parseStableCredits("10"))).to.not.be.reverted
    // check total supply after default
    expect(formatStableCredits(await stableCredit.totalSupply())).to.equal("30.0")
    expect(formatStableCredits(await stableCredit.networkDebt())).to.equal("0.0")
  })
  it("Network demurraged tokens fully reimburse members when burned", async function () {
    // deposit reserve reserve
    await expect(contracts.reservePool.depositFees(stableCredit.address, parseEther("100000"))).to
      .not.be.reverted
    // default Credit Line A
    await ethers.provider.send("evm_increaseTime", [100])
    await ethers.provider.send("evm_mine", [])
    await expect(contracts.riskManager.validateCreditLine(stableCredit.address, memberA.address)).to
      .not.be.reverted

    await expect(stableCredit.demurrageMembers(parseStableCredits("10.0"))).to.not.be.reverted

    expect(formatEther(await contracts.mockReferenceToken.balanceOf(memberB.address))).to.equal(
      "0.0"
    )

    await expect(stableCredit.burnDemurraged(memberB.address)).to.not.be.reverted

    expect(formatStableCredits(await stableCredit.balanceOf(memberB.address))).to.equal("6.666666")

    expect(formatEther(await contracts.mockReferenceToken.balanceOf(memberB.address))).to.equal(
      "3.333334"
    )
  })

  it("Network demurraged tokens partially reimburse members when burned", async function () {
    // deposit reserve reserve
    await expect(contracts.reservePool.depositFees(stableCredit.address, parseEther("3.0"))).to.not
      .be.reverted
    // default Credit Line A
    await ethers.provider.send("evm_increaseTime", [100])
    await ethers.provider.send("evm_mine", [])
    await expect(contracts.riskManager.validateCreditLine(stableCredit.address, memberA.address)).to
      .not.be.reverted
    await expect(stableCredit.demurrageMembers(parseStableCredits("10.0"))).to.not.be.reverted

    expect(formatEther(await contracts.mockReferenceToken.balanceOf(memberB.address))).to.equal(
      "0.0"
    )

    await expect(stableCredit.burnDemurraged(memberB.address)).to.not.be.reverted

    expect(formatStableCredits(await stableCredit.balanceOf(memberB.address))).to.equal("6.666666")

    expect(formatEther(await contracts.mockReferenceToken.balanceOf(memberB.address))).to.equal(
      "3.0"
    )
  })
})
