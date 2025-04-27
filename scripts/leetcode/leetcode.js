import { LeetCodeV1, LeetCodeV2 } from './versions.js';
import setupManualSubmitBtn from './submitBtn.js';
import {
  debounce,
  delay,
  DIFFICULTY,
  getBrowser,
  getDifficulty,
  isEmptyObject,
  LeetHubError,
  mergeStats,
} from './util.js';
import { appendProblemToReadme, sortTopicsInReadme } from './readmeTopics.js';

/* Commit messages */
const readmeMsg = 'Create README - LeetHub';
const updateReadmeMsg = 'Update README - Topic Tags';
const updateStatsMsg = 'Updated stats';
const discussionMsg = 'Prepend discussion post - LeetHub';
const createNotesMsg = 'Attach NOTES - LeetHub';
const defaultRepoReadme =
  'A collection of LeetCode questions to ace the coding interview! - Created using [LeetHub v2](https://github.com/arunbhardwaj/LeetHub-2.0)';
const readmeFilename = 'README.md';
const statsFilename = 'stats.json';

// problem types
const NORMAL_PROBLEM = 0;
const EXPLORE_SECTION_PROBLEM = 1;

const WAIT_FOR_GITHUB_API_TO_NOT_THROW_409_MS = 500;

const api = getBrowser();

/**
 * Constructs a file path by appending the given filename to the problem directory.
 * If no filename is provided, it returns the problem name as the path.
 * Also considers any subfolder path stored in leethub_path in chrome.storage.
 *
 * @param {string} problem - The base problem directory or the entire file path if no filename is provided.
 * @param {string} [filename] - Optional parameter for the filename to be appended to the problem directory.
 * @param {string} [subfolderPath] - Optional parameter for subfolder path to prepend.
 * @param {boolean} [forceRoot] - Force path to be in root directory.
 * @returns {string} - Returns a string representing the complete file path, either with or without the appended filename.
 */
const getPath = (problem, filename, subfolderPath, forceRoot) => {
  // Force to root directory if specified
  if (forceRoot) {
    return filename ? `${problem}/${filename}` : problem;
  }
  
  // If we have a subfolder path
  if (subfolderPath) {
    // Place all files (including README.md and stats.json) in the subfolder structure
    return filename ? `${subfolderPath}/${problem}/${filename}` : `${subfolderPath}/${problem}`;
  }
  
  // Original behavior without subfolders
  return filename ? `${problem}/${filename}` : problem;
};

// https://web.archive.org/web/20190623091645/https://monsur.hossa.in/2012/07/20/utf-8-in-javascript.html
// In order to preserve mutation of the data, we have to encode it, which is usually done in base64.
// But btoa only accepts ASCII 7 bit chars (0-127) while Javascript uses 16-bit minimum chars (0-65535).
// EncodeURIComponent converts the Unicode Points UTF-8 bits to hex UTF-8.
// Unescape converts percent-encoded hex values into regular ASCII (optional; it shrinks string size).
// btoa converts ASCII to base64.
/** Decodes a base64 encoded string into UTF-8 format using URI encoding.*/
const decode = data => decodeURIComponent(escape(atob(data)));
/** Encodes a given string into base64 format.*/
const encode = data => btoa(unescape(encodeURIComponent(data)));

/**
 * Uploads content to a specified GitHub repository and updates local stats with the sha of the updated file.
 * @async
 * @param {string} token - The authentication token used to authorize the request.
 * @param {string} hook - The owner and repository name in the format 'owner/repo'.
 * @param {string} content - The content to be uploaded, typically a string encoded in base64.
 * @param {string} problem - The problem slug, which is a combination of problem ID and name, and acts as a folder.
 * @param {string} filename - The name of the file, typically the problem slug + file extension.
 * @param {string} sha - The SHA of the existing file.
 * @param {string} message - A commit message describing the change.
 * @param {string} [difficulty] - The difficulty level of the problem.
 * @param {boolean} [forceRoot] - Whether to force the file to be in the root directory.
 *
 * @returns {Promise<string>} - A promise that resolves with the new SHA of the content after successful upload.
 *
 * @throws {LeetHubError} - Throws an error if the response is not OK (e.g., HTTP status code is not `200-299`).
 */
const upload = async (token, hook, content, problem, filename, sha, message, difficulty, forceRoot) => {
  // Get subfolder path if set
  const { leethub_path } = await api.storage.local.get('leethub_path');
  const subfolderPath = leethub_path || '';
  
  const path = getPath(problem, filename, subfolderPath, forceRoot);
  const URL = `https://api.github.com/repos/${hook}/contents/${path}`;

  let data = {
    message,
    content,
    sha,
  };

  let options = {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify(data),
  };

  const res = await fetch(URL, options);
  if (!res.ok) {
    throw new LeetHubError(res.status, { cause: res });
  }
  console.log(`Successfully committed ${getPath(problem, filename, subfolderPath, forceRoot)} to github`);

  const body = await res.json();
  //TODO: Think, should we be setting stats state here?
  const stats = await getAndInitializeStats(problem);
  stats.shas[problem][filename] = body.content.sha;
  api.storage.local.set({ stats });

  return body.content.sha;
};

// Returns stats object. If it didn't exist, initializes stats with default difficulty values and initializes the sha object for problem
const getAndInitializeStats = problem => {
  return api.storage.local.get('stats').then(({ stats }) => {
    if (stats == null || isEmptyObject(stats)) {
      stats = {};
      stats.shas = {};
      stats.solved = 0;
      stats.easy = 0;
      stats.medium = 0;
      stats.hard = 0;
    }

    if (stats.shas[problem] == null) {
      stats.shas[problem] = {};
    }

    return stats;
  });
};

/**
 * Increment the statistics for a given problem based on its difficulty.
 * @param {DIFFICULTY} difficulty - The difficulty level of the problem, which can be `easy`, `medium`, or `hard`.
 * @param {string} problem - The slug problem name, e.g. `0001-two-sum`
 * @returns {Promise<Object>} A promise that resolves to the updated statistics object.
 */
const incrementStats = (difficulty, problem) => {
  const diff = getDifficulty(difficulty);
  return api.storage.local.get('stats').then(({ stats }) => {
    // stats object initialization may be needed
    if (!stats) {
      stats = {};
    }
    if (!stats.shas) {
      stats.shas = {};
    }
    if (!stats.solved) {
      stats.solved = 0;
    }
    if (!stats.easy) {
      stats.easy = 0;
    }
    if (!stats.medium) {
      stats.medium = 0;
    }
    if (!stats.hard) {
      stats.hard = 0;
    }
    
    // Check for stats.shas[statsFilename] initialization - may be needed
    if (!stats.shas[statsFilename]) {
      stats.shas[statsFilename] = {};
    }
    
    // Initialize shas for each problem
    if (!stats.shas[problem]) {
      stats.shas[problem] = {};
    }
    
    stats.solved += 1;
    stats.easy += diff === DIFFICULTY.EASY ? 1 : 0;
    stats.medium += diff === DIFFICULTY.MEDIUM ? 1 : 0;
    stats.hard += diff === DIFFICULTY.HARD ? 1 : 0;
    stats.shas[problem].difficulty = diff.toLowerCase();
    api.storage.local.set({ stats });
    return stats;
  });
};

/**
 * Sets persistent stats and merges any cloud updates into local stats
 * @async
 * @param {Object} localStats - Local statistics about LeetCode problems.
 * @returns {Promise<void>} A promise that resolves to the sha of the newly updated `stats.json` file.
 *
 * @throws {Error} - If the upload operation fails for any reason other than 409 Conflict
 */
const setPersistentStats = async localStats => {
  let pStats = { leetcode: localStats };
  const pStatsEncoded = encode(JSON.stringify(pStats));
  const sha = localStats?.shas?.[statsFilename]?.[''] || '';

  const { leethub_token, leethub_hook } = await api.storage.local.get([
    'leethub_token',
    'leethub_hook',
  ]);

  try {
    // Set forceRoot parameter to false to save stats.json in subfolder
    return await upload(leethub_token, leethub_hook, pStatsEncoded, statsFilename, '', sha, updateStatsMsg, '', false);
  } catch (e) {
    if (e.message === '409') {
      // Stats were updated on GitHub since last submission
      // Get file from the proper subfolder location
      const { content, sha } = await getGitHubFile(leethub_token, leethub_hook, statsFilename, '', '', false).then(res =>
        res.json()
      );
      pStats = JSON.parse(decode(content));
      const mergedStats = mergeStats(pStats.leetcode, localStats);
      const mergedStatsEncoded = encode(JSON.stringify({ leetcode: mergedStats }));

      // Update local stats with the changes from GitHub
      await api.storage.local.set({ stats: mergedStats });

      return await delay(
        // Also set forceRoot to false here
        () => upload(leethub_token, leethub_hook, mergedStatsEncoded, statsFilename, '', sha, updateStatsMsg, '', false),
        WAIT_FOR_GITHUB_API_TO_NOT_THROW_409_MS
      );
    }
    throw e;
  }
};

const isCompleted = problemName => {
  return api.storage.local.get('stats').then(data => {
    if (data?.stats?.shas?.[problemName] == null) return false;

    for (let file of Object.keys(data?.stats?.shas?.[problemName])) {
      if (file.includes(problemName)) return true;
    }

    return false;
  });
};

/* Discussion posts prepended at top of README */
/* Future implementations may require appending to bottom of file */
const updateReadmeWithDiscussionPost = async (
  addition,
  directory,
  filename,
  commitMsg,
  shouldPreprendDiscussionPosts
) => {
  let responseSHA;
  const { leethub_token, leethub_hook, leethub_path } = await api.storage.local.get([
    'leethub_token',
    'leethub_hook',
    'leethub_path'
  ]);
  
  const subfolderPath = leethub_path || '';

  return getGitHubFile(leethub_token, leethub_hook, directory, filename, subfolderPath, true)
    .then(resp => resp.json())
    .then(data => {
      responseSHA = data.sha;
      return decode(data.content);
    })
    .then(existingContent =>
      shouldPreprendDiscussionPosts ? encode(addition + existingContent) : encode(existingContent)
    )
    .then(newContent =>
      upload(leethub_token, leethub_hook, newContent, directory, filename, responseSHA, commitMsg, '', true)
    );
};

/**
 * Wrapper func to upload code to a specific GitHub repository and handle 409 errors (conflict)
 * @async
 * @function uploadGitWith409Retry
 * @param {string} code - The code content that needs to be uploaded.
 * @param {string} problemName - The name of the problem or file where the code is related to.
 * @param {string} filename - The target filename in the repository where the code will be stored.
 * @param {string} commitMsg - The commit message that describes the changes being made.
 * @param {Object} [optionals] - Optional parameters for updating stats
 * @param {string} optionals.sha - The SHA value of the existing content to be updated (optional).
 * @param {DIFFICULTY} optionals.difficulty - The difficulty level of the problem (optional).
 * @param {boolean} optionals.forceRoot - Whether to force the file to be in the root directory (optional).
 *
 * @returns {Promise<string>} A promise that resolves with the new SHA of the content after successful upload.
 *
 * @throws {LeetHubError} If there's no token defined, the mode type is not `commit`, or if no repository hook is defined.
 */
async function uploadGitWith409Retry(code, problemName, filename, commitMsg, optionals) {
  let token;
  let hook;

  const storageData = await api.storage.local.get([
    'leethub_token',
    'mode_type',
    'leethub_hook',
    'stats',
  ]);

  token = storageData.leethub_token;
  if (!token) {
    throw new LeetHubError('LeethubTokenUndefined');
  }

  if (storageData.mode_type !== 'commit') {
    throw new LeetHubError('LeetHubNotAuthorizedByGit');
  }

  hook = storageData.leethub_hook;
  if (!hook) {
    throw new LeetHubError('NoRepoDefined');
  }

  /* Get SHA, if it exists */
  const sha = optionals?.sha
    ? optionals.sha
    : storageData.stats?.shas?.[problemName]?.[filename] !== undefined
    ? storageData.stats.shas[problemName][filename]
    : '';

  try {
    return await upload(
      token,
      hook,
      code,
      problemName,
      filename,
      sha,
      commitMsg,
      optionals?.difficulty,
      optionals?.forceRoot
    );
  } catch (err) {
    if (err.message === '409') {
      const data = await getGitHubFile(
        token, 
        hook, 
        problemName, 
        filename, 
        '', 
        optionals?.forceRoot
      ).then(res => res.json());
      
      return upload(
        token,
        hook,
        code,
        problemName,
        filename,
        data.sha,
        commitMsg,
        optionals?.difficulty,
        optionals?.forceRoot
      );
    }
    throw err;
  }
}

/** Returns GitHub data for the file specified by `${directory}/${filename}` path
 * @async
 * @function getGitHubFile
 * @param {string} token - The personal access token for authentication with GitHub.
 * @param {string} hook - The owner and repository name in the format "owner/repository".
 * @param {string} directory - The directory within the repository where the file is located.
 * @param {string} filename - The name of the file to be fetched.
 * @param {string} [subfolderPath] - Optional subfolder path to prepend.
 * @param {boolean} [forceRoot] - Whether to force getting the file from the root directory.
 * @returns {Promise<Response>} A promise that resolves with the response from the GitHub API request.
 * @throws {Error} Throws an error if the response is not OK (e.g., HTTP status code is not 200-299).
 */
async function getGitHubFile(token, hook, directory, filename, subfolderPath, forceRoot) {
  // Get subfolder path if not provided
  if (subfolderPath === undefined) {
    const { leethub_path } = await api.storage.local.get('leethub_path');
    subfolderPath = leethub_path || '';
  }
  
  const path = getPath(directory, filename, subfolderPath, forceRoot);
  const URL = `https://api.github.com/repos/${hook}/contents/${path}`;

  let options = {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  };

  const res = await fetch(URL, options);
  if (!res.ok) {
    throw new Error(res.status);
  }

  return res;
}

/* Discussion Link - When a user makes a new post, the link is prepended to the README for that problem.*/
document.addEventListener('click', event => {
  const element = event.target;
  const oldPath = window.location.pathname;

  /* Act on Post button click */
  /* Complex since "New" button shares many of the same properties as "Post button */
  if (
    element &&
    (element.classList.contains('icon__3Su4') ||
      element.parentElement?.classList.contains('icon__3Su4') ||
      element.parentElement?.classList.contains('btn-content-container__214G') ||
      element.parentElement?.classList.contains('header-right__2UzF'))
  ) {
    setTimeout(function () {
      /* Only post if post button was clicked and url changed */
      if (
        oldPath !== window.location.pathname &&
        oldPath === window.location.pathname.substring(0, oldPath.length) &&
        !Number.isNaN(window.location.pathname.charAt(oldPath.length))
      ) {
        const date = new Date();
        const currentDate = `${date.getDate()}/${date.getMonth()}/${date.getFullYear()} at ${date.getHours()}:${date.getMinutes()}`;
        const addition = `[Discussion Post (created on ${currentDate})](${window.location})  \n`;
        const problemName = window.location.pathname.split('/')[2]; // must be true.
        updateReadmeWithDiscussionPost(addition, problemName, readmeFilename, discussionMsg, true);
      }
    }, 1000);
  }
});

async function createRepoReadme() {
  const content = encode(defaultRepoReadme);
  
  // Create two READMEs - one in root and one in subfolder if needed
  const { leethub_path } = await api.storage.local.get('leethub_path');
  const subfolderPath = leethub_path || '';
  
  // Always create the root README
  const rootSha = await uploadGitWith409Retry(content, readmeFilename, '', readmeMsg, { forceRoot: true });
  
  // If a subfolder is specified, also create README there
  if (subfolderPath) {
    const subfolderReadmeContent = encode(`# LeetCode Problems\n\nA collection of LeetCode problems solved in this folder.\n\n<!---LeetCode Topics Start-->\n# LeetCode Topics\n<!---LeetCode Topics End-->`);
    await uploadGitWith409Retry(subfolderReadmeContent, readmeFilename, '', readmeMsg);
  }
  
  return rootSha;
}

async function createSubfolderReadme() {
  const { leethub_token, leethub_hook, leethub_path } = await api.storage.local.get([
    'leethub_token',
    'leethub_hook',
    'leethub_path'
  ]);
  
  if (!leethub_path) return null;
  
  const subfolderReadmeContent = encode(`# LeetCode Problems\n\nA collection of LeetCode problems solved in this folder.\n\n<!---LeetCode Topics Start-->\n# LeetCode Topics\n<!---LeetCode Topics End-->`);
  try {
    const sha = await uploadGitWith409Retry(
      subfolderReadmeContent, 
      readmeFilename, 
      '', 
      readmeMsg, 
      { forceRoot: false }
    );
    return sha;
  } catch (err) {
    console.error('Failed to create subfolder README:', err);
    return null;
  }
}

async function updateReadmeTopicTagsWithProblem(topicTags, problemName) {
  if (topicTags == null) {
    console.log(new LeetHubError('TopicTagsNotFound'));
    return;
  }

  // We only need to update the subfolder README
  const { leethub_token, leethub_hook, stats, leethub_path } = await api.storage.local.get([
    'leethub_token',
    'leethub_hook',
    'stats',
    'leethub_path'
  ]);
  
  // If no subfolder specified, there's nothing to do
  if (!leethub_path) return;
  
  const subfolderPath = leethub_path;
  let subfolderReadme;
  let subfolderSha;

  // Try to get existing subfolder README
  try {
    const { content, sha } = await getGitHubFile(
      leethub_token,
      leethub_hook,
      readmeFilename,
      '',
      subfolderPath,
      false // Not forcing root
    ).then(resp => resp.json());
    
    subfolderReadme = decode(content);
    subfolderSha = sha;
    
  } catch (err) {
    if (err.message === '404') {
      // Create subfolder README if it doesn't exist
      subfolderSha = await createSubfolderReadme();
      try {
        const { content } = await getGitHubFile(
          leethub_token,
          leethub_hook,
          readmeFilename,
          '',
          subfolderPath,
          false
        ).then(resp => resp.json());
        
        subfolderReadme = decode(content);
      } catch (innerErr) {
        console.error('Failed to get subfolder README after creation:', innerErr);
        return;
      }
    } else {
      console.error('Error getting subfolder README:', err);
      return;
    }
  }

  // Update subfolder README with topic tags
  for (let topic of topicTags) {
    subfolderReadme = await appendProblemToReadme(topic.name, subfolderReadme, leethub_hook, problemName);
  }
  subfolderReadme = sortTopicsInReadme(subfolderReadme);
  subfolderReadme = encode(subfolderReadme);

  // Upload updated subfolder README
  return delay(
    () => uploadGitWith409Retry(
      subfolderReadme, 
      readmeFilename, 
      '', 
      updateReadmeMsg, 
      { sha: subfolderSha, forceRoot: false }
    ),
    WAIT_FOR_GITHUB_API_TO_NOT_THROW_409_MS
  );
}

/** @param {LeetCodeV1 | LeetCodeV2} leetCode */
function loader(leetCode) {
  let iterations = 0;
  const intervalId = setInterval(async () => {
    try {
      const isSuccessfulSubmission = leetCode.getSuccessStateAndUpdate();
      if (!isSuccessfulSubmission) {
        iterations++;
        if (iterations > 9) {
          // poll for max 10 attempts (10 seconds)
          throw new LeetHubError('Could not find successful submission after 10 seconds.');
        }
        return;
      }
      leetCode.startSpinner();

      // If successful, stop polling
      clearInterval(intervalId);

      // For v2, query LeetCode API for submission results
      await leetCode.init();

      const probStats = leetCode.parseStats();
      if (!probStats) {
        throw new LeetHubError('SubmissionStatsNotFound');
      }

      const probStatement = leetCode.parseQuestion();
      if (!probStatement) {
        throw new LeetHubError('ProblemStatementNotFound');
      }

      const problemName = leetCode.getProblemNameSlug();
      const alreadyCompleted = await isCompleted(problemName);
      const language = leetCode.getLanguageExtension();
      if (!language) {
        throw new LeetHubError('LanguageNotFound');
      }
      const filename = problemName + language;

      /* Upload README */
      const uploadReadMe = await api.storage.local.get(['stats', 'leethub_path']).then(({ stats, leethub_path }) => {
        const shaExists = stats?.shas?.[problemName]?.[readmeFilename] !== undefined;

        if (!shaExists) {
          // Only upload README to problem folder, not to root
          return uploadGitWith409Retry(
            encode(probStatement),
            problemName,
            readmeFilename,
            readmeMsg,
            { forceRoot: false }
          );
        }
      });

      /* Upload Notes if any*/
      const notes = leetCode.getNotesIfAny();
      let uploadNotes;
      if (notes != undefined && notes.length > 0) {
        uploadNotes = uploadGitWith409Retry(encode(notes), problemName, 'NOTES.md', createNotesMsg);
      }

      /* Upload code to Git */
      const code = leetCode.findCode(probStats);
      const uploadCode = uploadGitWith409Retry(encode(code), problemName, filename, probStats);

      /* Group problem into its relevant topics */
      const updateRepoReadMe = updateReadmeTopicTagsWithProblem(
        leetCode.submissionData?.question?.topicTags,
        problemName
      );

      const newSHAs = await Promise.all([uploadReadMe, uploadNotes, uploadCode, updateRepoReadMe]);

      leetCode.markUploaded();

      if (!alreadyCompleted) {
        // Increments local and persistent stats
        incrementStats(leetCode.difficulty, problemName).then(setPersistentStats);
      }
    } catch (err) {
      leetCode.markUploadFailed();
      clearInterval(intervalId);

      if (!(err instanceof LeetHubError)) {
        console.error(err);
        return;
      }
    }
  }, 1000);
}

/**
 * Submit by Keyboard Shortcuts (only supported on LeetCode v2)
 * @param {Event} event
 * @returns
 */
function wasSubmittedByKeyboard(event) {
  const isEnterKey = event.key === 'Enter';
  const isMacOS = window.navigator.userAgent.includes('Mac');

  // Adapt to MacOS operating system
  return isEnterKey && ((isMacOS && event.metaKey) || (!isMacOS && event.ctrlKey));
}

/**
 * Get SubmissionID by listening for URL changes to `/submissions/(d+)` format
 * @returns {string} submissionId
 */
async function listenForSubmissionId() {
  const { submissionId } = await api.runtime.sendMessage({
    type: 'LEETCODE_SUBMISSION',
  });
  if (submissionId == null) {
    console.log(new LeetHubError('SubmissionIdNotFound'));
    return;
  }
  return submissionId;
}

/**
 * @param {Event} event
 * @param {LeetCodeV2} leetCode
 * @returns {void}
 */
async function v2SubmissionHandler(event, leetCode) {
  if (event.type !== 'click' && !wasSubmittedByKeyboard(event)) {
    return;
  }

  const authenticated =
    !isEmptyObject(await api.storage.local.get(['leethub_token'])) &&
    !isEmptyObject(await api.storage.local.get(['leethub_hook']));
  if (!authenticated) {
    throw new LeetHubError('UserNotAuthenticated');
  }

  // is click or is ctrl enter
  const submissionId = await listenForSubmissionId();
  leetCode.submissionId = submissionId;
  loader(leetCode);
  return true;
}

// Use MutationObserver to determine when the submit button elements are loaded
const submitBtnObserver = new MutationObserver(function (_mutations, observer) {
  const v1SubmitBtn = document.querySelector('[data-cy="submit-code-btn"]');
  const v2SubmitBtn = document.querySelector('[data-e2e-locator="console-submit-button"]');
  const textareaList = document.getElementsByTagName('textarea');
  const textarea =
    textareaList.length === 4
      ? textareaList[2]
      : textareaList.length === 2
      ? textareaList[0]
      : textareaList[1];

  if (v1SubmitBtn) {
    observer.disconnect();

    const leetCode = new LeetCodeV1();
    v1SubmitBtn.addEventListener('click', () => loader(leetCode));
    return;
  }

  if (v2SubmitBtn && textarea) {
    observer.disconnect();

    const leetCode = new LeetCodeV2();
    if (!!!v2SubmitBtn.onclick) {
      textarea.addEventListener('keydown', e => v2SubmissionHandler(e, leetCode));
      v2SubmitBtn.onclick = e => v2SubmissionHandler(e, leetCode);
    }
  }
});

submitBtnObserver.observe(document.body, {
  childList: true,
  subtree: true,
});

/* Sync to local storage */
api.storage.local.get('isSync', data => {
  const keys = [
    'leethub_token',
    'leethub_username',
    'pipe_leethub',
    'stats',
    'leethub_hook',
    'mode_type',
  ];
  if (!data || !data.isSync) {
    keys.forEach(key => {
      api.storage.sync.get(key, data => {
        api.storage.local.set({ [key]: data[key] });
      });
    });
    api.storage.local.set({ isSync: true }, () => {
      console.log('LeetHub Synced to local values');
    });
  } else {
    console.log('LeetHub Local storage already synced!');
  }
});

setupManualSubmitBtn(
  debounce(
    () => {
      const leetCode = new LeetCodeV2();
      // Manual submission event can only fire when we have submissionId. Simply retrieve it.
      const submissionId = window.location.href.match(/leetcode\.com\/.*\/submissions\/(\d+)/)[1];
      leetCode.submissionId = submissionId;
      loader(leetCode);
      return;
    },
    5000,
    true
  )
);

class LeetHubNetworkError extends LeetHubError {
  constructor(response) {
    super(response.statusText);
    this.status = response.status;
  }
}
