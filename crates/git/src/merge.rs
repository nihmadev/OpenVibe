use crate::error::{GitError, Result};
use crate::repository::open;
use git2::build::CheckoutBuilder;
use git2::Repository;

pub fn merge(path: &str, branch_name: &str) -> Result<()> {
    let repo = open(path)?;
    let head = repo.head()?;
    
    // Find the annotated commit for the branch to merge
    let fetch_head = repo.find_reference(&format!("refs/heads/{}", branch_name))?;
    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)?;
    
    let analysis = repo.merge_analysis(&[&fetch_commit])?;
    
    if analysis.0.is_up_to_date() {
        return Ok(());
    } else if analysis.0.is_fast_forward() {
        // Do a fast forward
        let refname = format!("refs/heads/{}", branch_name);
        let fetch_commit_obj = repo.find_commit(fetch_commit.id())?;
        
        let mut checkout_opts = CheckoutBuilder::new();
        checkout_opts.safe();
        repo.checkout_tree(fetch_commit_obj.as_object(), Some(&mut checkout_opts))?;
        
        if let Some(target) = head.target() {
            repo.reference(
                head.name().unwrap(),
                fetch_commit.id(),
                true,
                &format!("Fast-Forward: Setting {} to id: {}", head.name().unwrap(), fetch_commit.id()),
            )?;
            repo.set_head(head.name().unwrap())?;
        } else {
            repo.set_head(&refname)?;
        }
    } else if analysis.0.is_normal() {
        // Do a normal merge
        let mut merge_opts = git2::MergeOptions::new();
        let mut checkout_opts = CheckoutBuilder::new();
        checkout_opts.safe();
        
        repo.merge(&[&fetch_commit], Some(&mut merge_opts), Some(&mut checkout_opts))?;
        
        if repo.index()?.has_conflicts() {
            return Err(GitError::Other("Merge conflicts detected. Manual resolution is required.".into()));
        }
        
        // Create the merge commit
        let signature = repo.signature().or_else(|_| git2::Signature::now("Unknown", "unknown@example.com"))?;
        let local_commit = repo.find_commit(head.target().unwrap())?;
        let remote_commit = repo.find_commit(fetch_commit.id())?;
        let tree = repo.find_tree(repo.index()?.write_tree()?)?;
        
        let msg = format!("Merge branch '{}'", branch_name);
        
        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            &msg,
            &tree,
            &[&local_commit, &remote_commit],
        )?;
        
        repo.cleanup_state()?;
    }
    
    Ok(())
}
