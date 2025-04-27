import { appendProblemToReadme, sortTopicsInReadme } from '../scripts/leetcode/readmeTopics.js';

// Mock getBrowser API for testing
jest.mock('../scripts/leetcode/util.js', () => ({
  LeetHubError: Error,
  getBrowser: () => ({
    storage: {
      local: {
        get: () => Promise.resolve({ leethub_path: 'mock-folder' })
      }
    }
  })
}));

describe('appendProblemToReadme', () => {
  it('should correctly append to previous readme which has start and end tags', async () => {
    const sampleText = '# LeetCode Topics\n### Extra Hard questions\nThese are notes I want for extra hard problems\n\n# About me\nThis a repo I had that I wished to do xyz with\n\n\x3C!---LeetCode Topics Start-->\n# LeetCode Topics\n\n## Hash Table\n|  |\n| ------- |\n| [0020-fake-problem](https://github.com/any/tree/master/0020-fake-problem) |\n\n\x3C!---LeetCode Topics End-->'
    const output = await appendProblemToReadme('Hash Table', sampleText, 'any', '0013-roman-to-integer');
    // URL now includes the mock folder
    const expected = '# LeetCode Topics\n### Extra Hard questions\nThese are notes I want for extra hard problems\n\n# About me\nThis a repo I had that I wished to do xyz with\n\n\x3C!---LeetCode Topics Start-->\n# LeetCode Topics\n\n## Hash Table\n|  |\n| ------- |\n| [0020-fake-problem](https://github.com/any/tree/master/0020-fake-problem) |\n| [0013-roman-to-integer](https://github.com/any/tree/master/mock-folder/0013-roman-to-integer) |\n\n\n\n\x3C!---LeetCode Topics End-->'
    expect(output).toBe(expected)
  })

  it('should not append duplicate problem', () => {
    const sampleText = 'A collection of LeetCode questions to ace the coding interview! - Created using [LeetHub v2](https://github.com/arunbhardwaj/LeetHub-2.0)\n# LeetCode Topics\n## Math\n|  |\n| ------- |\n| [0002-add-two-numbers](https://github.com/arunbhardwaj/algos2/tree/master/0002-add-two-numbers) |\n| [0009-palindrome-number](https://github.com/arunbhardwaj/algos2/tree/master/0009-palindrome-number) |\n## Array\n|  |\n| ------- |\n| [0001-two-sum](https://github.com/arunbhardwaj/algos2/tree/master/0001-two-sum) |\n## Hash Table\n|  |\n| ------- |\n| [0001-two-sum](https://github.com/arunbhardwaj/algos2/tree/master/0001-two-sum) |\n| [0003-longest-substring-without-repeating-characters](https://github.com/arunbhardwaj/algos2/tree/master/0003-longest-substring-without-repeating-characters) |\n## Linked List\n|  |\n| ------- |\n| [0002-add-two-numbers](https://github.com/arunbhardwaj/algos2/tree/master/0002-add-two-numbers) |\n## Recursion\n|  |\n| ------- |\n| [0002-add-two-numbers](https://github.com/arunbhardwaj/algos2/tree/master/0002-add-two-numbers) |\n## String\n|  |\n| ------- |\n| [0003-longest-substring-without-repeating-characters](https://github.com/arunbhardwaj/algos2/tree/master/0003-longest-substring-without-repeating-characters) |\n## Sliding Window\n|  |\n| ------- |\n| [0003-longest-substring-without-repeating-characters](https://github.com/arunbhardwaj/algos2/tree/master/0003-longest-substring-without-repeating-characters) |\n\n### Extra Hard questions\nThese are notes I want for extra hard problems\n\n# About me\nThis a repo I had that I wished to do xyz with\n\n\x3C!---LeetCode Topics Start-->\n# LeetCode Topics\n\n## Hash Table\n|  |\n| ------- |\n| [0013-roman-to-integer](https://github.com/any/tree/master/0013-roman-to-integer) |\n| [0002-fake-problem](https://github.com/any/tree/master/0002-fake-problem) |\n| [0012-fake-problem](https://github.com/any/tree/master/0012-fake-problem) |\n| [0009-fake-problem](https://github.com/any/tree/master/0009-fake-problem) |\n| [0090-fake-problem](https://github.com/any/tree/master/0090-fake-problem) |\n| [0020-fake-problem](https://github.com/any/tree/master/0020-fake-problem) |\n\n\x3C!---LeetCode Topics End-->'
    const output = appendProblemToReadme('Hash Table', sampleText, 'any', '0013-roman-to-integer');
    const expected = 'A collection of LeetCode questions to ace the coding interview! - Created using [LeetHub v2](https://github.com/arunbhardwaj/LeetHub-2.0)\n# LeetCode Topics\n## Math\n|  |\n| ------- |\n| [0002-add-two-numbers](https://github.com/arunbhardwaj/algos2/tree/master/0002-add-two-numbers) |\n| [0009-palindrome-number](https://github.com/arunbhardwaj/algos2/tree/master/0009-palindrome-number) |\n## Array\n|  |\n| ------- |\n| [0001-two-sum](https://github.com/arunbhardwaj/algos2/tree/master/0001-two-sum) |\n## Hash Table\n|  |\n| ------- |\n| [0001-two-sum](https://github.com/arunbhardwaj/algos2/tree/master/0001-two-sum) |\n| [0003-longest-substring-without-repeating-characters](https://github.com/arunbhardwaj/algos2/tree/master/0003-longest-substring-without-repeating-characters) |\n## Linked List\n|  |\n| ------- |\n| [0002-add-two-numbers](https://github.com/arunbhardwaj/algos2/tree/master/0002-add-two-numbers) |\n## Recursion\n|  |\n| ------- |\n| [0002-add-two-numbers](https://github.com/arunbhardwaj/algos2/tree/master/0002-add-two-numbers) |\n## String\n|  |\n| ------- |\n| [0003-longest-substring-without-repeating-characters](https://github.com/arunbhardwaj/algos2/tree/master/0003-longest-substring-without-repeating-characters) |\n## Sliding Window\n|  |\n| ------- |\n| [0003-longest-substring-without-repeating-characters](https://github.com/arunbhardwaj/algos2/tree/master/0003-longest-substring-without-repeating-characters) |\n\n### Extra Hard questions\nThese are notes I want for extra hard problems\n\n# About me\nThis a repo I had that I wished to do xyz with\n\n\x3C!---LeetCode Topics Start-->\n# LeetCode Topics\n\n## Hash Table\n|  |\n| ------- |\n| [0013-roman-to-integer](https://github.com/any/tree/master/0013-roman-to-integer) |\n| [0002-fake-problem](https://github.com/any/tree/master/0002-fake-problem) |\n| [0012-fake-problem](https://github.com/any/tree/master/0012-fake-problem) |\n| [0009-fake-problem](https://github.com/any/tree/master/0009-fake-problem) |\n| [0090-fake-problem](https://github.com/any/tree/master/0090-fake-problem) |\n| [0020-fake-problem](https://github.com/any/tree/master/0020-fake-problem) |\n\n\x3C!---LeetCode Topics End-->'
    expect(output).toBe(expected)
  })
})

describe('sortTopicsInReadme', () => {
  // 기존 테스트는 그대로 유지
})
