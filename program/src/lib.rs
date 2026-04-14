use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::invoke,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};

entrypoint!(process_instruction);

/// Accounts expected:
///   0. `[writable, signer]` payer — pays the rent-exempt deposit
///   1. `[writable, signer]` new_account — the account to create (fresh keypair)
///   2. `[]`                 system_program
///
/// Instruction data: the raw bytes to write into the new account.
/// The program allocates exactly `instruction_data.len()` bytes and copies
/// the data in directly.  The account owner is set to this program.
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let payer = next_account_info(accounts_iter)?;
    let new_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    let space = instruction_data.len() as u64;
    let lamports = Rent::get()?.minimum_balance(space as usize);

    msg!(
        "instryx-data-writer: creating account {} with {} bytes, {} lamports",
        new_account.key,
        space,
        lamports
    );

    invoke(
        &system_instruction::create_account(
            payer.key,
            new_account.key,
            lamports,
            space,
            program_id,
        ),
        &[payer.clone(), new_account.clone(), system_program.clone()],
    )?;

    if space > 0 {
        let mut data = new_account.data.borrow_mut();
        data.copy_from_slice(instruction_data);
    }

    Ok(())
}
