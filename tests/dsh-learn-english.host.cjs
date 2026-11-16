const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

async function main() {
  const root = path.resolve(__dirname, '../plugins/dsh-learn-english')
  const prompts = await import(pathToFileURL(path.join(root, 'server/prompts.js')).href)
  const edge = await import(pathToFileURL(path.join(root, 'server/edge-tts.js')).href)

  assert.deepEqual([...prompts.modeIds()].sort(), ['free', 'polish'])

  assert.equal(
    edge.generateSecMsGec(1700000000000),
    '2CD23A2CA0B2595A-F3C846C370E05F9CC83ACC5F995C5F5D87A4D0F14CE8936A0F902E64099E38A2',
  )

  assert.equal(prompts.containsNonEnglishScript('That sounds natural.'), false)
  assert.equal(prompts.containsNonEnglishScript('Let’s keep going — you’re doing well!'), false)
  assert.equal(prompts.containsNonEnglishScript('这个说法很自然。'), true)
  assert.equal(prompts.containsNonEnglishScript('That is natural，right？'), true)

  assert.equal(
    prompts.normalizePolishOutput('Natural American English: “I’d love to join you.”'),
    'I’d love to join you.',
  )
  assert.equal(
    prompts.normalizePolishOutput('I really like this city.'),
    'I really like this city.',
  )

  const messages = prompts.prepareMessages('polish', [
    { role: 'user', content: `first ${'a'.repeat(9000)}` },
    { role: 'assistant', content: `second ${'b'.repeat(9000)}` },
    { role: 'user', content: '这个方案我觉得还行，但预算有点高。' },
  ])
  assert.equal(messages.length, 1, 'Polish must not carry prior turns into the model')
  assert.equal(messages[0].role, 'user')
  assert.match(messages[0].content[0].text, /预算/)

  const freeMessages = prompts.prepareMessages('free', [
    { role: 'user', content: 'I like coffee.' },
    { role: 'assistant', content: 'Coffee is great. Do you have a favorite kind?' },
    { role: 'user', content: 'I like lattes.' },
  ])
  assert.equal(freeMessages.length, 3, 'Free talk must keep its conversation context')

  assert.equal(prompts.toSpeechText('**Hello** `there` — [link](https://example.com)'), 'Hello there — link')
  assert.equal(prompts.toSpeechText('# Heading\n\n- First item\n- Second item').includes('#'), false)

  console.log('dsh-learn-english host: PASS')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
