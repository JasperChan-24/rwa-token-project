import { isAddress } from 'viem'

export { propertyTokenAbi } from './generated/propertyTokenAbi'

// Current Sepolia deployment. Sourcify reports exact creation/runtime matches;
// NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS can override it for another reviewed deployment.
const deployedSepoliaAddress = '0xCac265066d612b6FE1E2Ff323bEDa97879f71aC3'
const configuredAddress =
  process.env.NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS || deployedSepoliaAddress

export const propertyTokenAddress = isAddress(configuredAddress)
  ? configuredAddress
  : undefined
