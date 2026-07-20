import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const buildInfoDirectory = resolve('artifacts/build-info')
const artifactPath = resolve(
  'artifacts/contracts/PropertyToken.sol/PropertyToken.json',
)
const artifact = JSON.parse(await readFile(artifactPath, 'utf8'))
const buildInfoId = artifact.buildInfoId

if (typeof buildInfoId !== 'string' || buildInfoId.length === 0) {
  throw new Error(
    `Hardhat artifact ${artifactPath} does not identify its build info. Run the production Hardhat build first.`,
  )
}

const buildInfoPath = resolve(buildInfoDirectory, `${buildInfoId}.json`)
const buildInfo = JSON.parse(await readFile(buildInfoPath, 'utf8'))
if (buildInfo.id !== buildInfoId) {
  throw new Error(
    `Build-info ID mismatch: artifact references ${buildInfoId}, file contains ${buildInfo.id ?? 'no id'}.`,
  )
}

const standardInput = buildInfo.input
if (
  !standardInput?.sources?.['project/contracts/PropertyToken.sol'] ||
  standardInput.settings?.optimizer?.enabled !== true ||
  standardInput.settings?.optimizer?.runs !== 200
) {
  throw new Error(
    `Artifact build info ${buildInfoId} is not the expected optimized PropertyToken production build.`,
  )
}

await mkdir(resolve('verification'), { recursive: true })
const outputPath = resolve('verification/PropertyToken.standard-input.json')
await writeFile(outputPath, `${JSON.stringify(standardInput, null, 2)}\n`, 'utf8')
console.log(`Exported ${outputPath} from ${buildInfoId}`)
