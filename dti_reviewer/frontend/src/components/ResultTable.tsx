import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface author {
  orcid: string
  author: string
  name_variations: string[]
  similarity: number
}

interface ResultTableProps {
  dataToDisplay: author[]
}

const percentFmt = new Intl.NumberFormat(undefined, {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});


export function ResultTable({ dataToDisplay }: ResultTableProps) {
  return (
    <>
      <Table id="searchTable">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px] sticky top-0 z-10 bg-primary text-primary-foreground">S.No.</TableHead>
            <TableHead className="sticky top-0 z-10 bg-primary text-primary-foreground">Author name</TableHead>
            <TableHead className="sticky top-0 z-10 bg-primary text-primary-foreground">Orcid</TableHead>
            <TableHead className="sticky top-0 z-10 bg-primary text-primary-foreground">Similarity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dataToDisplay.map((authorInfo, index) => (
            <TableRow key={authorInfo.orcid}>
              <TableCell className="font-medium">{index + 1}</TableCell>
              <TableCell>{authorInfo.author}</TableCell>
              <TableCell>
                <a
                  href={`https://orcid.org/${authorInfo.orcid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  {authorInfo.orcid.slice(1)}
                </a>
              </TableCell>
              <TableCell>{percentFmt.format(authorInfo.similarity)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
        </TableFooter>
      </Table>
    </>
  )
}