import { Card } from "@/components/ui/card";
import { CreateUser } from "./create-user";
import { UserList } from "./user-list";

export const UsersPage = () => {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4">
      <Card className="shadow-md">
        <Card.Header>
          <Card.Title className="text-2xl font-semibold">Create user</Card.Title>
        </Card.Header>
        <Card.Content>
          <CreateUser />
        </Card.Content>
      </Card>

      <Card className="shadow-md">
        <Card.Header>
          <Card.Title className="text-2xl font-semibold">Users</Card.Title>
        </Card.Header>
        <Card.Content>
          <UserList />
        </Card.Content>
      </Card>
    </div>
  );
};
