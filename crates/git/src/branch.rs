use crate::error::{GitError, Result};
use crate::repository::open;
use git2::build::CheckoutBuilder;

pub fn create_branch(path: &str, name: &str) -> Result<()> {
    let repo = open(path)?;
    let head = repo.head()?;
    let commit = head.peel_to_commit()?;
    
    repo.branch(name, &commit, false)?;
    Ok(())
}

pub fn delete_branch(path: &str, name: &str) -> Result<()> {
    let repo = open(path)?;
    let mut branch = repo.find_branch(name, git2::BranchType::Local)?;
    branch.delete().map_err(GitError::Git2)
}

pub fn checkout_branch(path: &str, name: &str) -> Result<()> {
    let repo = open(path)?;
    let ref_name = format!("refs/heads/{}", name);
    let obj = repo.revparse_single(&ref_name)?;
    
    let mut checkout_opts = CheckoutBuilder::new();
    checkout_opts.safe();
    
    repo.checkout_tree(&obj, Some(&mut checkout_opts))?;
    repo.set_head(&ref_name)?;
    Ok(())
}
