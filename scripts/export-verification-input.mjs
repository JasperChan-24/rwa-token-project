import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const buildInfoDirectory = resolve('artifacts/build-info')
const entries = (await readdir(buildInfoDirectory))
  .filter((entry) => entry.endsWith('.json') && !entry.endsWith('.output.json'))
  .sort()

let standardInput
for (const entry of entries) {
  const buildInfo = JSON.parse(
    await readFile(resolve(buildInfoDirectory, entry), 'utf8'),
  )
  const input = buildInfo.input
  if (
    input?.sources?.['project/contracts/PropertyToken.sol'] &&
    input.settings?.optimizer?.enabled === true &&
    input.settings?.optimizer?.runs === 200
  ) {
    standardInput = input
    break
  }
}

if (!standardInput) {
  throw new Error(
    'No production PropertyToken standard JSON input found. Run the production Hardhat build first.',
  )
}

await mkdir(resolve('verification'), { recursive: true })
const outputPath = resolve('verification/PropertyToken.standard-input.json')
await writeFile(outputPath, `${JSON.stringify(standardInput, null, 2)}\n`, 'utf8')
console.log(`Exported ${outputPath}`)
