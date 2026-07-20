import { expect, test } from '@playwright/test'

const contractAddress = '0xCac265066d612b6FE1E2Ff323bEDa97879f71aC3'

test('renders the public dashboard with truthful demo boundaries', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('RWA Dashboard')
  await expect(
    page.getByRole('heading', { name: 'RWA Yield Dashboard', level: 1 }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', {
      name: 'Direct transfer between allowlisted wallets',
      level: 2,
    }),
  ).toBeVisible()
  await expect(
    page.getByText(/this deployment performs no identity, KYC, AML/i),
  ).toBeVisible()
  await expect(page.getByText(/OTC transfer|secondary market/i)).toHaveCount(0)

  const contractLink = page.getByRole('link', {
    name: 'View contract on Sepolia Etherscan',
  })
  await expect(contractLink).toHaveAttribute(
    'href',
    `https://sepolia.etherscan.io/address/${contractAddress}`,
  )

  await page.getByRole('button', { name: '中' }).click()
  await expect(
    page.getByRole('heading', { name: 'RWA 资产分红看板', level: 1 }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: '链上允许名单钱包间直接转账', level: 2 }),
  ).toBeVisible()
  await expect(page.getByText(/没有执行身份核验、KYC、AML/)).toBeVisible()
})
