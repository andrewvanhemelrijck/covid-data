const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');
const { formatOWIDData } = require('./utils');

const githubCredentials = {
  owner: 'andrewvanhemelrijck',
  repo: 'covid-tracker',
};

async function getFileContentsString(octokit, path) {
  try {
    const file = await octokit.repos.getContent({
      ...githubCredentials,
      path,
    });

    return Buffer.from(file.data.content, 'base64').toString();
  } catch (error) {
    // TODO: if file is too big, run large file func
    core.setFailed(error.message);
  }
}

async function getSHA(octokit, path) {
  try {
    // get branch
    const branch = await octokit.repos.getBranch({
      ...githubCredentials,
      branch: 'master',
    });

    // get tree with  branch sha
    const tree = await octokit.git.getTree({
      ...githubCredentials,
      branch: 'master',
      tree_sha: branch.data.commit.commit.tree.sha,
      recursive: true,
    });

    // find blob file_sha
    const file = tree.data.tree.find(({ path: filePath }) => filePath === path);

    return file
      ? file.sha
      : undefined;
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function getLargeFileContentsString(octokit, file_sha) {
  try {
    const file = await octokit.git.getBlob({
      ...githubCredentials,
      file_sha
    });

    return Buffer.from(file.data.content, 'base64').toString();
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function fetchFileContents(path) {
  try {
    const response = await axios(path);
    return response.data;
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function createOrUpdateFiles({
  octokit,
  path,
  fileContent,
  sha,
}) {
  try {
    await octokit.repos.createOrUpdateFileContents({
      ...githubCredentials,
      path,
      message: `data update ${path} ${new Date().toISOString()}`,
      content: Buffer.from(fileContent).toString('base64'),
      sha,
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function run() {
  const myToken = core.getInput('repo-token');
  const octokit = github.getOctokit(myToken);

  // check if data is outdated
  const currentOWIDUpdatedTimestamp = await getFileContentsString(octokit, 'data/owid/owid-covid-data-last-updated-timestamp.txt');
  const newOWIDUpdatedTimestamp = await fetchFileContents('https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/owid-covid-data-last-updated-timestamp.txt');
  if (new Date(currentOWIDUpdatedTimestamp) >= new Date(newOWIDUpdatedTimestamp)) return;

  // archive the current covid-data json file
  const currentOWIDDataSHA = await getSHA(octokit, 'data/owid/owid-covid-data.json');
  const currentOWIDData = await getLargeFileContentsString(octokit, currentOWIDDataSHA);
  await createOrUpdateFiles({
    octokit,
    path: `data/owid/archive/owid-covid-data-${new Date().toISOString()}.json`,
    fileContent: currentOWIDData,
  });

  // build and save new files
  const newOWIDData = await fetchFileContents('https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/owid-covid-data.json');
  const newOWIDDataJSON = JSON.stringify(formatOWIDData(newOWIDData));
  await createOrUpdateFiles({
    octokit,
    path: `data/owid/owid-covid-data.json`,
    fileContent: JSON.stringify(newOWIDData),
    sha: await getSHA(octokit, `data/owid/owid-covid-data.json`)
  });
  await createOrUpdateFiles({
    octokit,
    path: `data/covid-world-data.json`,
    fileContent: newOWIDDataJSON,
    sha: await getSHA(octokit, `data/covid-world-data.json`)
  });
  await createOrUpdateFiles({
    octokit,
    path: `data/owid/owid-covid-data-last-updated-timestamp.txt`,
    fileContent: new Date().toISOString(),
    sha: await getSHA(octokit, `data/owid/owid-covid-data-last-updated-timestamp.txt`)
  });
}

try {
  run();
} catch (error) {
  core.setFailed(error.message);
}
