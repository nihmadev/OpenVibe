use std::io;

fn main() {
    println!("Простой калькулятор");
    println!("Поддерживаемые операции: +, -, *, /");
    
    loop {
        println!("Введите первое число (или 'exit' для выхода):");
        let mut input1 = String::new();
        io::stdin().read_line(&mut input1).expect("Ошибка ввода");
        let input1 = input1.trim();
        
        if input1 == "exit" {
            break;
        }
        
        let num1: f64 = match input1.parse() {
            Ok(num) => num,
            Err(_) => {
                println!("Некорректное число!");
                continue;
            }
        };
        
        println!("Введите операцию (+, -, *, /):");
        let mut op = String::new();
        io::stdin().read_line(&mut op).expect("Ошибка ввода");
        let op = op.trim();
        
        if !["+", "-", "*", "/"].contains(&op) {
            println!("Неподдерживаемая операция!");
            continue;
        }
        
        println!("Введите второе число:");
        let mut input2 = String::new();
        io::stdin().read_line(&mut input2).expect("Ошибка ввода");
        let input2 = input2.trim();
        
        let num2: f64 = match input2.parse() {
            Ok(num) => num,
            Err(_) => {
                println!("Некорректное число!");
                continue;
            }
        };
        
        let result = match op {
            "+" => num1 + num2,
            "-" => num1 - num2,
            "*" => num1 * num2,
            "/" => {
                if num2 == 0.0 {
                    println!("Ошибка: деление на ноль!");
                    continue;
                } else {
                    num1 / num2
                }
            }
            _ => {
                println!("Неподдерживаемая операция!");
                continue;
            }
        };
        
        println!("Результат: {} {} {} = {}", num1, op, num2, result);
    }
}