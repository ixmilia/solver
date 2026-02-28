export function greet(name: string): string {
    return `Hello, ${name}!`;
}

export function main(): void {
    alert(greet("World"));
}
